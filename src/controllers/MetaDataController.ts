import {
  Controller,
  Get,
  Header,
  Param,
  QueryParam,
} from 'routing-controllers';
import Moralis from 'moralis/node';
import { ResponseSchema } from 'routing-controllers-openapi';
import { eip137Namehash, znsNamehash } from '../utils/namehash';
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

const DEFAULT_IMAGE_URL =
  `${env.APPLICATION.ERC721_METADATA.GOOGLE_CLOUD_STORAGE_BASE_URL}/images/unstoppabledomains.svg` as const;
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
export enum Network {
  Polygon = '137',
  Binance = '56',
  Avalanche = '43114',
  Fantom = '250',
}

const getChainName = (chainId: string): SupportedL2Chain | 'eth' => {
  switch (chainId) {
    case Network.Polygon:
      return SupportedL2Chain.Polygon;
    case Network.Binance:
      return SupportedL2Chain.Binance;
    case Network.Avalanche:
      return SupportedL2Chain.Avalanche;
    case Network.Fantom:
      return SupportedL2Chain.Fantom;
    default:
      return 'eth';
  }
};

let initialized = false;
const initMoralisSdk = async (): Promise<typeof Moralis> => {
  if (initialized) {
    return Moralis;
  }

  const serverUrl = env.MORALIS.API_URL;
  const appId = env.MORALIS.APP_ID;
  await Moralis.start({ serverUrl, appId });
  initialized = true;
  return Moralis;
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
    const token = this.normalizeDomainOrToken(domainOrToken);
    const domain =
      (await Domain.findByNode(token)) ||
      (await Domain.findOnChainNoSafe(token));
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
    const token = this.normalizeDomainOrToken(domainOrToken);
    const domain =
      (await Domain.findByNode(token)) ||
      (await Domain.findOnChainNoSafe(token));
    const resolution = domain ? getDomainResolution(domain) : undefined;
    const name = domain ? domain.name : domainOrToken;

    if (!name.includes('.')) {
      return { image_data: '' };
    }

    if (domain && resolution && this.isDomainWithCustomImage(domain.name)) {
      const { socialPicture, image } = await this.fetchTokenMetadata(
        domain,
        resolution,
        withOverlay,
      );

      return {
        image:
          (withOverlay ? socialPicture : image) ||
          this.generateDomainImageUrl(domain.name),
        image_data: '',
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
    const token = this.normalizeDomainOrToken(domainOrToken);
    const domain =
      (await Domain.findByNode(token)) ||
      (await Domain.findOnChainNoSafe(token));
    const resolution = domain ? getDomainResolution(domain) : undefined;
    const name = domain ? domain.name : domainOrToken;

    if (!name.includes('.')) {
      return '';
    }

    if (domain && resolution && this.isDomainWithCustomImage(domain.name)) {
      const { socialPicture, image } = await this.fetchTokenMetadata(
        domain,
        resolution,
        withOverlay,
        true,
      );
      const svgFromImage = `<svg
        width="300"
        height="300"
        viewBox="0 0 300 300"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <image
          href="${image}"
          width="300"
          height="300"
        />
      </svg>`;

      return (
        (withOverlay ? socialPicture : svgFromImage) ||
        this.generateDomainImageUrl(domain.name) ||
        ''
      );
    }

    const imageData = await this.generateImageData(
      name,
      resolution?.resolution || {},
    );
    return await pathThatSvg(imageData);
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

    const moralis = await initMoralisSdk();
    const options = {
      chain: getChainName(chainId),
      address: contractAddress,
      token_id: tokenId,
    };
    let image = '';
    let fetchedMetadata;
    let tokenIdMetadata;
    let validNftPfp = false;

    if (options.chain && options.address && options.token_id) {
      try {
        tokenIdMetadata = await moralis.Web3API.token.getTokenIdMetadata(
          options,
        );
      } catch (error) {
        logger.error(error);
      }
    }
    if (
      resolution?.ownerAddress &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (tokenIdMetadata as any)?.owner_of.toLowerCase() ===
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
      image = fetchedMetadata?.image || fetchedMetadata?.image_url;
    }
    let socialPicture = '';
    if (validNftPfp && !!image && withOverlay) {
      const {
        base64: backgroundImageData,
        imageUrl: backgroundImageUrl,
        mimeType,
      } = await getNFTSocialPicture(image).catch(() => ({
        base64: '',
        imageUrl: '',
        mimeType: null,
      }));

      if (backgroundImageData || backgroundImageUrl) {
        // adding the overlay
        socialPicture = createSocialPictureImage(
          domain,
          backgroundImageData,
          backgroundImageUrl,
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

  private normalizeDomainOrToken(domainOrToken: string): string {
    if (domainOrToken.includes('.')) {
      return this.normalizeDomain(domainOrToken);
    } else if (domainOrToken.replace('0x', '').match(/^[a-fA-F0-9]+$/)) {
      return this.normalizeToken(domainOrToken);
    }
    return domainOrToken;
  }

  private normalizeDomain(domain: string): string {
    domain = domain.trim().toLowerCase();

    if (domain.endsWith('.zil')) {
      return znsNamehash(domain);
    }
    return eip137Namehash(domain);
  }

  private normalizeToken(token: string): string {
    return '0x' + BigInt(token).toString(16).padStart(64, '0');
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
    const splittedName = name.split('.');
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

  private generateDomainImageUrl(name: string): string | null {
    if (this.isDomainWithCustomImage(name)) {
      return `${BASE_IMAGE_URL}/${CustomImageDomains[name]}`;
    }

    const animalImageUrl = AnimalHelper.getAnimalImageUrl(name);
    if (animalImageUrl) {
      return animalImageUrl;
    }

    return DEFAULT_IMAGE_URL;
  }
}
