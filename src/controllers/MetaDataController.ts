import {
  Controller,
  Get,
  Header,
  Param,
  QueryParam,
} from 'routing-controllers';
import Moralis from 'moralis/node';
import { ResponseSchema } from 'routing-controllers-openapi';
import fetch from 'node-fetch';
import Domain from '../models/Domain';
import AnimalDomainHelper, {
  OpenSeaMetadataAttribute,
} from '../utils/AnimalDomainHelper/AnimalDomainHelper';
import { DefaultImageData } from '../utils/generalImage';
import { MetadataImageFontSize } from '../types/common';
import { pathThatSvg } from 'path-that-svg';
import { IsArray, IsObject, IsOptional, IsString } from 'class-validator';
import { env } from '../env';
import { logger } from '../logger';
import {
  getNFTSocialPicture,
  createSocialPictureImage,
  parsePictureRecord,
} from '../utils/socialPicture';
import punycode from 'punycode';
import { getDomainResolution } from '../services/Resolution';
import { PremiumDomains, CustomImageDomains } from '../utils/domainCategories';
import { DomainsResolution } from '../models';
import { OpenSeaPort, Network } from 'opensea-js';
import { EthereumProvider } from '../workers/EthereumProvider';
import { simpleSVGTemplate } from '../utils/socialPicture/svgTemplate';
import { findDomainByNameOrToken } from '../utils/domain';

const DEFAULT_IMAGE_URL = (name: string) =>
  `https://metadata.unstoppabledomains.com/image-src/${name}.svg` as const;
const BASE_IMAGE_URL =
  `${env.APPLICATION.ERC721_METADATA.GOOGLE_CLOUD_STORAGE_BASE_URL}/images` as const;
const INVALID_DOMAIN_IMAGE_URL =
  `${env.APPLICATION.ERC721_METADATA.GOOGLE_CLOUD_STORAGE_BASE_URL}/images/invalid-domain.svg` as const;

export enum SupportedL2Chain {
  Polygon = 'polygon',
  Binance = 'bsc',
  Avalanche = 'avalanche',
  Fantom = 'fantom',
}
export enum NetworkId {
  Polygon = '137',
  Binance = '56',
  Avalanche = '43114',
  Fantom = '250',
}

const getChainName = (chainId: string): SupportedL2Chain | 'eth' => {
  switch (chainId) {
    case NetworkId.Polygon:
      return SupportedL2Chain.Polygon;
    case NetworkId.Binance:
      return SupportedL2Chain.Binance;
    case NetworkId.Avalanche:
      return SupportedL2Chain.Avalanche;
    case NetworkId.Fantom:
      return SupportedL2Chain.Fantom;
    default:
      return 'eth';
  }
};

let isMoralisInitialized = false;
const initMoralisSdk = async (): Promise<typeof Moralis> => {
  if (isMoralisInitialized) {
    return Moralis;
  }

  const serverUrl = env.MORALIS.API_URL;
  const appId = env.MORALIS.APP_ID;
  await Moralis.start({ serverUrl, appId });
  isMoralisInitialized = true;
  return Moralis;
};

let openSeaSDK: OpenSeaPort | undefined;
const initOpenSeaSdk = (): OpenSeaPort => {
  if (openSeaSDK) {
    return openSeaSDK;
  }

  openSeaSDK = new OpenSeaPort(EthereumProvider, {
    networkName: Network.Main,
    apiKey: env.OPENSEA.API_KEY,
  });

  return openSeaSDK;
};

const AnimalHelper: AnimalDomainHelper = new AnimalDomainHelper();

type DomainProperties = {
  records: Record<string, string>;
};

class Erc721Metadata {
  @IsString()
  name: string | null;

  @IsString()
  description: string | null;

  @IsString()
  image: string | null;

  @IsString()
  external_url: string | null;
}

class OpenSeaMetadata extends Erc721Metadata {
  @IsOptional()
  @IsString()
  external_link?: string;

  @IsOptional()
  @IsString()
  image_url?: string;

  @IsOptional()
  @IsString()
  image_data?: string | null;

  @IsObject()
  properties: DomainProperties;

  @IsArray()
  attributes: Array<OpenSeaMetadataAttribute>;

  @IsOptional()
  @IsString()
  background_color?: string;

  @IsOptional()
  @IsString()
  animation_url?: string;

  @IsOptional()
  @IsString()
  youtube_url?: string;
}

class TokenMetadata {
  @IsObject()
  fetchedMetadata: {
    name: string;
    token_uri?: string;
    metadata?: string;
    image?: string;
    background_color?: string;
  };

  @IsString()
  socialPicture: string;

  @IsString()
  image: string;
}

class ImageResponse {
  @IsOptional()
  @IsString()
  image?: string | null;

  @IsString()
  image_data: string;
}

@Controller()
export class MetaDataController {
  @Get('/deaddata/:domainOrToken')
  @ResponseSchema(OpenSeaMetadata)
  async getDeadData(): Promise<{
    name: string;
    description: string;
    image: string;
    background_color: string;
  }> {
    const description = 'This domain is invalid';

    return {
      name: 'INVALID DOMAIN',
      description,
      image: INVALID_DOMAIN_IMAGE_URL,
      background_color: 'FFFFFF',
    };
  }

  @Get('/metadata/:domainOrToken')
  @ResponseSchema(OpenSeaMetadata)
  async getMetaData(
    @Param('domainOrToken') domainOrToken: string,
    @QueryParam('withOverlay') withOverlay = true,
  ): Promise<OpenSeaMetadata> {
    const domain = await findDomainByNameOrToken(domainOrToken);
    if (!domain) {
      return this.defaultMetaResponse(domainOrToken);
    }
    const resolution = getDomainResolution(domain);

    const { socialPicture, image } = await this.fetchTokenMetadata(
      domain,
      resolution,
      withOverlay,
    );

    const description = this.getDomainDescription(
      domain.name,
      resolution.resolution,
    );
    const domainAttributes = this.getDomainAttributes(domain.name, {
      ipfsContent:
        resolution.resolution['dweb.ipfs.hash'] ||
        resolution.resolution['ipfs.html.value'],
      verifiedNftPicture: socialPicture !== '',
    });

    const metadata: OpenSeaMetadata = {
      name: domain.name,
      description,
      properties: {
        records: resolution.resolution,
      },
      external_url: `https://unstoppabledomains.com/search?searchTerm=${domain.name}`,
      image:
        (withOverlay ? socialPicture : image) ||
        this.generateDomainImageUrl(domain.name),
      image_url: this.generateDomainImageUrl(domain.name),
      attributes: domainAttributes,
    };

    if (
      !this.isDomainWithCustomImage(domain.name) &&
      !socialPicture &&
      !image
    ) {
      metadata.image_data = await this.generateImageData(
        domain.name,
        resolution.resolution,
      );
      metadata.background_color = '4C47F7';
    }

    if (!this.isValidDNSDomain(domain.name)) {
      metadata.attributes.push({ value: 'invalid' });
    }

    if (domain.isUnicodeName) {
      metadata.attributes.push({
        value: 'unicode',
      });
    }

    return metadata;
  }

  @Get('/image/:domainOrToken')
  @ResponseSchema(ImageResponse)
  async getImage(
    @Param('domainOrToken') domainOrToken: string,
    @QueryParam('withOverlay') withOverlay = true,
  ): Promise<ImageResponse> {
    const domain = await findDomainByNameOrToken(domainOrToken);
    const resolution = domain ? getDomainResolution(domain) : undefined;
    const name = domain ? domain.name : domainOrToken;

    if (!name.includes('.')) {
      return { image_data: '' };
    }

    if (domain && resolution) {
      const { socialPicture, image } = await this.fetchTokenMetadata(
        domain,
        resolution,
        withOverlay,
      );
      const [imageData, mimeType] = await getNFTSocialPicture(image).catch(
        () => ['', null],
      );
      const svgFromImage = simpleSVGTemplate(
        withOverlay ? socialPicture : `data:${mimeType};base64,${imageData}`,
      );

      return {
        image_data:
          socialPicture || imageData
            ? svgFromImage
            : await this.generateImageData(name, resolution?.resolution || {}),
      };
    }

    return {
      image_data: await this.generateImageData(
        name,
        resolution?.resolution || {},
      ),
    };
  }

  @Get('/image-src/:domainOrToken')
  @Header('Access-Control-Allow-Origin', '*')
  @Header('Content-Type', 'image/svg+xml')
  async getImageSrc(
    @Param('domainOrToken') domainOrToken: string,
    @QueryParam('withOverlay') withOverlay = true,
  ): Promise<string> {
    const domain = await findDomainByNameOrToken(
      domainOrToken.replace('.svg', ''),
    );
    const resolution = domain ? getDomainResolution(domain) : undefined;
    const name = domain ? domain.name : domainOrToken.replace('.svg', '');

    if (!name.includes('.')) {
      return '';
    }

    if (domain && resolution) {
      const { socialPicture, image } = await this.fetchTokenMetadata(
        domain,
        resolution,
        withOverlay,
        true,
      );
      const [imageData, mimeType] = await getNFTSocialPicture(image).catch(
        () => ['', null],
      );
      const svgFromImage = imageData
        ? simpleSVGTemplate(`data:${mimeType};base64,${imageData}`)
        : '';

      return (
        (withOverlay ? socialPicture : svgFromImage) ||
        (await pathThatSvg(
          await this.generateImageData(name, resolution?.resolution || {}),
        ))
      );
    }

    return await pathThatSvg(
      await this.generateImageData(name, resolution?.resolution || {}),
    );
  }

  private async fetchTokenMetadata(
    domain: Domain,
    resolution: DomainsResolution,
    withOverlay: boolean,
    raw = false,
  ): Promise<TokenMetadata> {
    let chainId = '';
    let contractAddress = '';
    let tokenId = '';

    if (resolution.resolution['social.picture.value']) {
      try {
        const parsedPicture = parsePictureRecord(
          resolution.resolution['social.picture.value'],
        );

        chainId = parsedPicture.chainId;
        contractAddress = parsedPicture.contractAddress;
        tokenId = parsedPicture.tokenId;
      } catch (error) {
        console.log(error);
      }
    }

    const options = {
      chain: getChainName(chainId),
      address: contractAddress,
      token_id: tokenId,
    };
    let image = '';
    let fetchedMetadata;
    let tokenIdMetadata;
    let validNftPfp = false;

    if (options.address && options.token_id) {
      try {
        if (options.chain === 'eth') {
          const openSea = initOpenSeaSdk();
          const response = await openSea.api.getAsset({
            tokenAddress: contractAddress,
            tokenId: tokenId,
          });
          fetchedMetadata = {
            image: response.imageUrl.endsWith('=s250')
              ? response.imageUrl.split('=s250')[0]
              : response.imageUrl,
            background_color: response.backgroundColor,
            owner_of: response.owner.address,
          };
          image = fetchedMetadata.image;
        } else {
          const moralis = await initMoralisSdk();
          tokenIdMetadata = await moralis.Web3API.token.getTokenIdMetadata(
            options,
          );
        }
      } catch (error: any) {
        if (!error.message.includes('No metadata found')) {
          logger.error(error);
        }
      }
    }
    const fetchedOwnerAddress =
      (tokenIdMetadata as any)?.owner_of || fetchedMetadata?.owner_of || '';
    if (
      resolution?.ownerAddress &&
      fetchedOwnerAddress.toLowerCase() ===
        resolution.ownerAddress.toLowerCase()
    ) {
      validNftPfp = true;
    }
    if (validNftPfp && tokenIdMetadata?.metadata) {
      try {
        fetchedMetadata = JSON.parse(tokenIdMetadata.metadata);
        image = fetchedMetadata?.image;
      } catch (error) {
        console.log(error);
      }
    }

    if (validNftPfp && !image && !!tokenIdMetadata?.token_uri) {
      const response = await fetch(tokenIdMetadata.token_uri, {
        timeout: 5000,
      });
      fetchedMetadata = await response.json();
      image = fetchedMetadata?.image;
    }
    let socialPicture = '';
    if (validNftPfp && !!image && withOverlay) {
      const [data, mimeType] = await getNFTSocialPicture(image).catch(() => [
        '',
        null,
      ]);

      if (data) {
        // adding the overlay
        socialPicture = createSocialPictureImage(
          domain,
          data,
          mimeType,
          fetchedMetadata?.background_color || '',
          raw,
        );
      }
    }

    return { fetchedMetadata, socialPicture, image };
  }

  private async defaultMetaResponse(
    domainOrToken: string,
  ): Promise<OpenSeaMetadata> {
    const name = domainOrToken.includes('.') ? domainOrToken : null;
    const description = name ? this.getDomainDescription(name, {}) : null;
    const attributes = name ? this.getDomainAttributes(name) : [];
    const image = name ? this.generateDomainImageUrl(name) : null;
    const image_data = name ? await this.generateImageData(name, {}) : null;
    const external_url = name
      ? `https://unstoppabledomains.com/search?searchTerm=${name}`
      : null;
    return {
      name,
      description,
      properties: {
        records: {},
      },
      external_url,
      attributes,
      image,
      image_data,
    };
  }

  private getDomainDescription(
    name: string,
    resolution: Record<string, string>,
  ): string {
    const levels = name.split('.').length;
    const ipfsDescriptionPart = this.getIpfsDescriptionPart(resolution);

    // todo find a better way for this edge case.
    if (name === 'india.crypto') {
      return 'This exclusive art piece by Amrit Pal Singh features hands of different skin tones spelling out the word HOPE in sign language. Hope embodies people coming together and having compassion for others in a way that transcends geographical borders. This art is a reminder that, while one individual can’t uplift humanity on their own, collective and inclusive efforts give rise to meaningful change.'.concat(
        ipfsDescriptionPart,
      );
    }

    if (levels === 1) {
      return "This is the only TLD on the Unstoppable registry. It's not owned by anyone.".concat(
        ipfsDescriptionPart,
      );
    } else if (levels === 2) {
      return 'A CNS or UNS blockchain domain. Use it to resolve your cryptocurrency addresses and decentralized websites.'.concat(
        ipfsDescriptionPart,
      );
    }

    return 'BE CAREFUL! This is a subdomain. Even after purchasing this name, the parent domain has the right to revoke ownership of this domain at anytime. Unless the parent is a smart contract specifically designed otherwise.'.concat(
      ipfsDescriptionPart,
    );
  }

  private getIpfsDescriptionPart(records: Record<string, string>): string {
    const ipfsHash = records['dweb.ipfs.hash'] || records['ipfs.html.value'];
    if (ipfsHash) {
      return `\nhttps://gateway.pinata.cloud/ipfs/${ipfsHash}`;
    }
    return '';
  }

  private getDomainAttributes(
    name: string,
    meta?: {
      ipfsContent?: string;
      verifiedNftPicture?: boolean;
    },
  ): OpenSeaMetadataAttribute[] {
    let domainType = 'standard';
    const attributes = [
      ...this.getBasicDomainAttributes(name, meta),
      ...this.getAnimalAttributes(name),
    ];
    if (attributes.find((attribute) => attribute.trait_type === 'animal')) {
      domainType = 'animal';
    }
    if (PremiumDomains.includes(name)) {
      domainType = 'premium';
    }
    attributes.push({ trait_type: 'type', value: domainType });
    return attributes;
  }

  private getBasicDomainAttributes(
    name: string,
    meta?: {
      ipfsContent?: string;
      verifiedNftPicture?: boolean;
    },
  ): OpenSeaMetadataAttribute[] {
    const attributes: OpenSeaMetadataAttribute[] = [
      {
        trait_type: 'domain',
        value: name,
      },
      {
        trait_type: 'level',
        value: name.split('.').length,
      },
      {
        trait_type: 'length',
        value: punycode.toUnicode(name).split('.')[0].length,
      },
    ];

    if (meta?.ipfsContent) {
      attributes.push({ trait_type: 'IPFS Content', value: meta?.ipfsContent });
    }
    if (meta?.verifiedNftPicture) {
      attributes.push({
        trait_type: 'picture',
        value: 'verified-nft',
      });
    }

    return attributes;
  }

  private getAnimalAttributes(name: string): OpenSeaMetadataAttribute[] {
    return AnimalHelper.getAnimalAttributes(name);
  }

  private isDomainWithCustomImage(name: string): boolean {
    return Boolean(CustomImageDomains[name]);
  }

  private isValidDNSDomain(domain: string): boolean {
    const labels = domain.split('.');
    if (labels[labels.length - 1] === '') {
      labels.pop();
    }

    return (
      labels.every((label) => /^(?![0-9]+$)[a-zA-Z0-9-]{1,63}$/.test(label)) &&
      labels.reduce((a, v) => v.length + a, 0) < 253
    );
  }

  private async generateImageData(
    name: string,
    resolution: Record<string, string>,
  ): Promise<string> {
    if (this.isDomainWithCustomImage(name)) {
      return '';
    }
    const splittedName = name.replace(/\.svg/g, '').split('.');
    const extension = splittedName.pop() || '';
    const label = splittedName.join('.');

    const animalImage = await AnimalHelper.getAnimalImageData(name);
    if (animalImage) {
      return animalImage;
    }

    const imagePathFromDomain = resolution['social.image.value'];
    if (
      imagePathFromDomain &&
      imagePathFromDomain.startsWith(
        'https://cdn.unstoppabledomains.com/bucket/',
      ) &&
      imagePathFromDomain.endsWith('.svg')
    ) {
      try {
        const ret = await fetch(imagePathFromDomain);
        return await ret.text();
      } catch (error) {
        logger.error(
          `Failed to generate image data from the following endpoint: ${imagePathFromDomain}`,
        );
        logger.error(error);
        return this.generateDefaultImageData(label, extension);
      }
    }
    return this.generateDefaultImageData(label, extension);
  }

  private generateDefaultImageData(label: string, tld: string) {
    let fontSize: MetadataImageFontSize = 24;
    if (label.length > 21) {
      fontSize = 20;
    }
    if (label.length > 24) {
      fontSize = 18;
    }
    if (label.length > 27) {
      fontSize = 16;
    }
    if (label.length > 30) {
      label = label.substr(0, 29).concat('...');
    }
    return DefaultImageData({ label, tld, fontSize });
  }

  private generateDomainImageUrl(name: string): string {
    if (this.isDomainWithCustomImage(name)) {
      return `${BASE_IMAGE_URL}/${CustomImageDomains[name]}`;
    }

    const animalImageUrl = AnimalHelper.getAnimalImageUrl(name);
    if (animalImageUrl) {
      return animalImageUrl;
    }

    return DEFAULT_IMAGE_URL(name);
  }
}
