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
import { IsArray, IsOptional, IsString } from 'class-validator';
import { env } from '../env';
import { logger } from '../logger';
import { getSocialPictureUrl } from '../utils/socialPicture';
import punycode from 'punycode';

const DEFAULT_IMAGE_URL = `${env.APPLICATION.ERC721_METADATA.GOOGLE_CLOUD_STORAGE_BASE_URL}/images/unstoppabledomains.svg` as const;
const CUSTOM_IMAGE_URL = `${env.APPLICATION.ERC721_METADATA.GOOGLE_CLOUD_STORAGE_BASE_URL}/images/custom` as const;
const INVALID_DOMAIN_IMAGE_URL = `${env.APPLICATION.ERC721_METADATA.GOOGLE_CLOUD_STORAGE_BASE_URL}/images/invalid-domain.svg` as const;
const DomainsWithCustomImage: Record<string, string> = {
  'code.crypto': 'code.svg',
  'web3.crypto': 'web3.svg',
  'privacy.crypto': 'privacy.svg',
  'surf.crypto': 'surf.svg',
  'hosting.crypto': 'hosting.svg',
  'india.crypto': 'india.jpg',
  'reseller-test-mago012.crypto': 'smiley-face.jpg',
};
const AnimalHelper: AnimalDomainHelper = new AnimalDomainHelper();

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
    const domain = await Domain.findByNode(token);
    if (!domain) {
      return this.defaultMetaResponse(domainOrToken);
    }
    const socialPictureUrl = await getSocialPictureUrl(
      domain.resolution['social.picture.value'],
      domain.ownerAddress || '',
    ).catch(() => '');

    const description = this.getDomainDescription(
      domain.name,
      domain.resolution,
    );
    const domainAttributes = this.getDomainAttributes(
      domain.name,
      domain.resolution,
      socialPictureUrl !== '',
    );

    const metadata: OpenSeaMetadata = {
      name: domain.name,
      description,
      external_url: `https://unstoppabledomains.com/search?searchTerm=${domain.name}`,
      image: socialPictureUrl || this.generateDomainImageUrl(domain.name),
      attributes: domainAttributes,
    };

    if (!this.isDomainWithCustomImage(domain.name) && !socialPictureUrl) {
      metadata.image_data = await this.generateImageData(
        domain.name,
        domain.resolution,
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
    const domain = await Domain.findByNode(token);

    const name = domain ? domain.name : domainOrToken;
    const resolution = domain ? domain.resolution : {};

    if (!name.includes('.')) {
      return { image_data: '' };
    }

    return {
      image_data: await this.generateImageData(name, resolution),
    };
  }

  @Get('/image-src/:domainOrToken')
  @Header('Access-Control-Allow-Origin', '*')
  @Header('Content-Type', 'image/svg+xml')
  async getImageSrc(
    @Param('domainOrToken') domainOrToken: string,
  ): Promise<string> {
    const token = this.normalizeDomainOrToken(domainOrToken);
    const domain = await Domain.findByNode(token);

    const name = domain ? domain.name : domainOrToken;
    const resolution = domain ? domain.resolution : {};

    if (!name.includes('.')) {
      return '';
    }

    const imageData = await this.generateImageData(name, resolution);
    return await pathThatSvg(imageData);
  }

  private async defaultMetaResponse(
    domainOrToken: string,
  ): Promise<OpenSeaMetadata> {
    const name = domainOrToken.includes('.') ? domainOrToken : null;
    const description = name ? this.getDomainDescription(name, {}) : null;
    const attributes = name ? this.getDomainAttributes(name, {}, false) : [];
    const image = name ? this.generateDomainImageUrl(name) : null;
    const image_data = name ? await this.generateImageData(name, {}) : null;
    const external_url = name
      ? `https://unstoppabledomains.com/search?searchTerm=${name}`
      : null;
    return {
      name,
      description,
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
    resolution: Record<string, string>,
    validNftAvatar?: boolean,
  ): OpenSeaMetadataAttribute[] {
    const attributes = [
      ...this.getBasicDomainAttributes(name, resolution),
      ...this.getAnimalAttributes(name),
    ];
    if (validNftAvatar) {
      attributes.push({
        trait_type: 'avatar',
        value: 'verified-nft',
      });
    }
    return attributes;
  }

  private getBasicDomainAttributes(
    name: string,
    resolution: Record<string, string>,
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

    const currencies = Object.keys(resolution)
      .filter((key) => key.startsWith('crypto') && key.endsWith('address'))
      .map((key) => ({
        trait_type: key.slice('crypto.'.length, key.length - '.address'.length),
        value: resolution[key],
      }))
      .filter((r) => r.value);
    attributes.push(...currencies);

    const ipfsContent =
      resolution['dweb.ipfs.hash'] || resolution['ipfs.html.value'];
    if (ipfsContent) {
      attributes.push({ trait_type: 'IPFS Content', value: ipfsContent });
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
    if (DomainsWithCustomImage[name]) {
      return `${CUSTOM_IMAGE_URL}/${DomainsWithCustomImage[name]}`;
    }

    const animalImageUrl = AnimalHelper.getAnimalImageUrl(name);
    if (animalImageUrl) {
      return animalImageUrl;
    }

    return DEFAULT_IMAGE_URL;
  }
}
