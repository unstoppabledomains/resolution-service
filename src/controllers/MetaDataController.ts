import { Controller, Get, Header, Param, Res } from 'routing-controllers';
import { ResponseSchema } from 'routing-controllers-openapi';
import { eip137Namehash, znsNamehash } from '../utils/namehash';
import Domain from '../models/Domain';
import AnimalDomainHelper, {
  OpenSeaMetadataAttribute,
} from '../utils/AnimalDomainHelper/AnimalDomainHelper';
import { DefaultImageData } from '../utils/generalImage';
import { MetadataImageFontSize } from '../types/common';
import { env } from '../env';
import { logger } from '../logger';
import {
  getSocialPictureUrl,
  getNFTSocialPicture,
  createSocialPictureImage,
  hasSocialPicture,
} from '../utils/socialPicture';
import punycode from 'punycode';
import { getDomainResolution } from '../services/Resolution';
import { OpenSeaMetadata } from './dto/Metadata';
import { Response } from 'express';
import { DomainsResolution } from '../models';

const DEFAULT_IMAGE_URL =
  `${env.APPLICATION.ERC721_METADATA.GOOGLE_CLOUD_STORAGE_BASE_URL}/images/unstoppabledomains.svg` as const;
const BASE_IMAGE_URL =
  `${env.APPLICATION.ERC721_METADATA.GOOGLE_CLOUD_STORAGE_BASE_URL}/images` as const;
const INVALID_DOMAIN_IMAGE_URL =
  `${env.APPLICATION.ERC721_METADATA.GOOGLE_CLOUD_STORAGE_BASE_URL}/images/invalid-domain.svg` as const;
const DomainsWithCustomImage: Record<string, string> = {
  'code.crypto': 'custom/code.svg',
  'web3.crypto': 'custom/web3.svg',
  'privacy.crypto': 'custom/privacy.svg',
  'surf.crypto': 'custom/surf.svg',
  'hosting.crypto': 'custom/hosting.svg',
  'india.crypto': 'custom/india.jpg',
};
const BASE_METADATA_IMAGE_URL =
  env.APPLICATION.ERC721_METADATA.METADATA_BASE_URI;
const AnimalHelper: AnimalDomainHelper = new AnimalDomainHelper();

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

    const description = this.getDomainDescription(
      domain.name,
      resolution.resolution,
    );

    const hasPicture = await hasSocialPicture(
      resolution.resolution['social.picture.value'],
      resolution.ownerAddress || '',
    );

    const domainAttributes = this.getDomainAttributes(domain.name, {
      ipfsContent:
        resolution.resolution['dweb.ipfs.hash'] ||
        resolution.resolution['ipfs.html.value'],
      verifiedNftPicture: hasPicture,
    });

    const metadata: OpenSeaMetadata = {
      name: domain.name,
      description,
      properties: {
        records: resolution.resolution,
      },
      external_url: `https://unstoppabledomains.com/search?searchTerm=${domain.name}`,
      image: `${BASE_METADATA_IMAGE_URL}/metadata/${domain.name}/image`,
      background_color: '4C47F7',
      attributes: domainAttributes,
    };

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

  @Get('/metadata/:domainOrToken/image')
  @Header('Access-Control-Allow-Origin', '*')
  async getImageSrc(
    @Param('domainOrToken') domainOrToken: string,
    @Res() response: Response,
  ): Promise<Response> {
    const token = this.normalizeDomainOrToken(domainOrToken);
    const domain =
      (await Domain.findByNode(token)) ||
      (await Domain.findOnChainNoSafe(token));

    if (!domain) {
      response.redirect(DEFAULT_IMAGE_URL);
      return response;
    }

    const resolution = getDomainResolution(domain);

    // if image is default - redirect
    const imageUrl = this.generateDomainImageUrl(domain.name);
    if (imageUrl) {
      response.redirect(imageUrl);
      return response;
    }

    // if image is custom - generate and return
    const imageData = await this.generateImageData(domain, resolution);

    response.setHeader('Content-Type', 'image/svg+xml');
    return response.send(imageData);
  }

  private async defaultMetaResponse(
    domainOrToken: string,
  ): Promise<OpenSeaMetadata> {
    const name = domainOrToken.includes('.') ? domainOrToken : null;
    const description = name ? this.getDomainDescription(name, {}) : null;
    const attributes = name ? this.getDomainAttributes(name) : [];
    const image = name
      ? `${BASE_METADATA_IMAGE_URL}/metadata/${name}/image`
      : null;
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
      background_color: '4C47F7',
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
    domain: Domain,
    resolution: DomainsResolution,
  ): Promise<string> {
    try {
      const { pictureOrUrl, nftStandard, backgroundColor } =
        await getSocialPictureUrl(
          resolution.resolution['social.picture.value'],
          resolution.ownerAddress || '',
        );

      if (pictureOrUrl) {
        const [data, mimeType] = await getNFTSocialPicture(
          nftStandard,
          pictureOrUrl,
        );
        const socialPicture = createSocialPictureImage(
          domain,
          data,
          mimeType,
          backgroundColor,
        );
        return socialPicture;
      }
    } catch (error) {
      // In case we can't get the social picture, use default.
      logger.warn(error);
    }

    const splittedName = domain.name.split('.');
    const extension = splittedName.pop() || '';
    const label = splittedName.join('.');

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

    return null;
  }
}
