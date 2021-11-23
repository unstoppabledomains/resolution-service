import { Controller, Get, Header, Param } from 'routing-controllers';
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
import { getSocialPicture } from '../utils/socialPicture';
import punycode from 'punycode';
import { getDomainResolution } from '../services/Resolution';
import { binanceCustomImages } from '../utils/customDomains';
import DomainsResolution from '../models/DomainsResolution';

const DEFAULT_IMAGE_URL = `${env.APPLICATION.ERC721_METADATA.GOOGLE_CLOUD_STORAGE_BASE_URL}/images/unstoppabledomains.svg` as const;
const BASE_IMAGE_URL = `${env.APPLICATION.ERC721_METADATA.GOOGLE_CLOUD_STORAGE_BASE_URL}/images` as const;
const INVALID_DOMAIN_IMAGE_URL = `${env.APPLICATION.ERC721_METADATA.GOOGLE_CLOUD_STORAGE_BASE_URL}/images/invalid-domain.svg` as const;
const DomainsWithCustomImage: Record<string, string> = {
  'code.crypto': 'custom/code.svg',
  'web3.crypto': 'custom/web3.svg',
  'privacy.crypto': 'custom/privacy.svg',
  'surf.crypto': 'custom/surf.svg',
  'hosting.crypto': 'custom/hosting.svg',
  'india.crypto': 'custom/india.jpg',
  ...binanceCustomImages,
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

class ImageResponse {
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
  ): Promise<OpenSeaMetadata> {
    const token = this.normalizeDomainOrToken(domainOrToken);
    const domain =
      (await Domain.findByNode(token)) ||
      (await Domain.findOnChainNoSafe(token));
    if (!domain) {
      return this.defaultMetaResponse(domainOrToken);
    }
    const resolution = getDomainResolution(domain);

    const socialPicture = await getSocialPicture({
      domainName: domain.name,
      avatarRecord: resolution.resolution['social.picture.value'] || '',
      ownerAddress: resolution.ownerAddress || '',
    });
    const description = this.getDomainDescription(
      domain.name,
      resolution.resolution,
    );
    const domainAttributes = this.getDomainAttributes(domain.name, {
      ipfsContent:
        resolution.resolution['dweb.ipfs.hash'] ||
        resolution.resolution['ipfs.html.value'],
      verifiedNftPicture: !!socialPicture,
    });

    const metadata: OpenSeaMetadata = {
      name: domain.name,
      description,
      properties: {
        records: resolution.resolution,
      },
      external_url: `https://unstoppabledomains.com/search?searchTerm=${domain.name}`,
      image: socialPicture || this.generateDomainImageUrl(domain.name),
      attributes: domainAttributes,
    };

    if (!this.isDomainWithCustomImage(domain.name) && !socialPicture) {
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
  ): Promise<ImageResponse> {
    const token = this.normalizeDomainOrToken(domainOrToken);
    const domain =
      (await Domain.findByNode(token)) ||
      (await Domain.findOnChainNoSafe(token));

    const name = domain ? domain.name : domainOrToken;
    const resolution = domain
      ? getDomainResolution(domain)
      : ({} as DomainsResolution);
    const records = resolution.resolution || {};
    if (!name.includes('.')) {
      return { image_data: '' };
    }
    const socialPicture = await getSocialPicture({
      domainName: name,
      avatarRecord: records['social.picture.value'] || '',
      ownerAddress: resolution.ownerAddress || '',
    });
    return {
      image_data:
        socialPicture || (await this.generateImageData(name, records)),
    };
  }

  @Get('/image-src/:domainOrToken')
  @Header('Access-Control-Allow-Origin', '*')
  @Header('Content-Type', 'image/svg+xml')
  async getImageSrc(
    @Param('domainOrToken') domainOrToken: string,
  ): Promise<string> {
    const token = this.normalizeDomainOrToken(domainOrToken);
    const domain =
      (await Domain.findByNode(token)) ||
      (await Domain.findOnChainNoSafe(token));

    const name = domain ? domain.name : domainOrToken;
    const resolution = domain
      ? getDomainResolution(domain)
      : ({} as DomainsResolution);
    const records = resolution.resolution || {};

    if (!name.includes('.')) {
      return '';
    }

    let socialPicture = await getSocialPicture({
      domainName: name,
      avatarRecord: records['social.picture.value'] || '',
      ownerAddress: resolution.ownerAddress || '',
      toBase64: false,
    });

    if (!socialPicture) {
      socialPicture = await this.generateImageData(name, records);
    }

    return await pathThatSvg(socialPicture);
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
    return [
      ...this.getBasicDomainAttributes(name, meta),
      ...this.getAnimalAttributes(name),
    ];
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
    return Boolean(DomainsWithCustomImage[name]);
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
    if (this.isDomainWithCustomImage(name) && !binanceCustomImages[name]) {
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
    if (DomainsWithCustomImage[name]) {
      return `${BASE_IMAGE_URL}/${DomainsWithCustomImage[name]}`;
    }

    const animalImageUrl = AnimalHelper.getAnimalImageUrl(name);
    if (animalImageUrl) {
      return animalImageUrl;
    }

    return DEFAULT_IMAGE_URL;
  }
}
