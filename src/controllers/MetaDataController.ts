import { Controller, Get, Header, Param } from 'routing-controllers';
import { ResponseSchema } from 'routing-controllers-openapi';
import { eip137Namehash, znsNamehash } from '../utils/namehash';
import fetch from 'node-fetch';
import Domain from '../models/Domain';
import AnimalDomainHelper from '../utils/AnimalDomainHelper/AnimalDomainHelper';
import { DefaultImageData } from '../utils/generalImage';
import { MetadataImageFontSize } from '../types/common';
import { pathThatSvg } from 'path-that-svg';

export class Erc721Metadata {
  name: string;
  description: string;
  image: string;
  external_url: string;
}

export type OpenSeaMetadataAttribute =
  | {
      value: string | number;
    }
  | {
      trait_type: string;
      value: string | number;
    }
  | {
      display_type:
        | 'number'
        | 'date'
        | 'boost_number'
        | 'boost_percentage'
        | 'ranking';
      trait_type: string;
      value: number;
    };

export class OpenSeaMetadata extends Erc721Metadata {
  external_link?: string;
  image_data?: string;
  attributes: Array<OpenSeaMetadataAttribute>;
  background_color?: string;
  animation_url?: string;
  youtube_url?: string;
}

export class ImageResponse {
  image_data: string;
}

@Controller()
export class MetaDataController {
  private animalHelper: AnimalDomainHelper = new AnimalDomainHelper();

  @Get('/metadata/:domainOrToken')
  @ResponseSchema(OpenSeaMetadata)
  async getMetaData(
    @Param('domainOrToken') domainOrToken: string,
  ): Promise<OpenSeaMetadata> {
    const token = this.normalizeDomainOrToken(domainOrToken);
    const domain = await Domain.findByNode(token);
    if (!domain) {
      throw new Error(`Entity ${domainOrToken} is not found`);
    }

    const description = this.getDomainDescription(domain);
    const domainAttributes = this.getDomainAttributes(domain);
    const domainAnimalAttributes = this.getAnimalAttributes(domain);

    const metadata: OpenSeaMetadata = {
      name: domain.name,
      description,
      external_url: `https://unstoppabledomains.com/search?searchTerm=${domain.name}`,
      image: domain.image,
      attributes: [...domainAttributes, ...domainAnimalAttributes],
    };

    if (!this.isDomainWithCustomImage(domain)) {
      metadata.image_data = await this.generateImageData(
        domain,
        metadata.attributes,
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
    if (!domain) {
      throw new Error(`Entity ${domainOrToken} is not found`);
    }

    const domainAttributes = [
      ...this.getDomainAttributes(domain),
      ...this.getAnimalAttributes(domain),
    ];
    return {
      image_data: await this.generateImageData(domain, domainAttributes),
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

    if (!domain) {
      throw new Error(`Entity ${domainOrToken} is not found`);
    }
    const domainAttributes = [
      ...this.getDomainAttributes(domain),
      ...this.getAnimalAttributes(domain),
    ];
    const imageData = await this.generateImageData(domain, domainAttributes);
    return await pathThatSvg(imageData);
  }

  private normalizeDomainOrToken(domainOrToken: string): string {
    if (domainOrToken.includes('.')) {
      return this.normalizeDomain(domainOrToken);
    } else if (domainOrToken.match(/^[0-9]*$/)) {
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

  private getDomainDescription(domain: Domain): string {
    const levels = domain.levelCount;
    const ipfsDescriptionPart = this.getIpfsDescriptionPart(domain.resolution);

    // todo find a better way for this edge case.
    if (domain.name === 'india.crypto') {
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

  private getDomainAttributes(domain: Domain): OpenSeaMetadataAttribute[] {
    const attributes: OpenSeaMetadataAttribute[] = [
      {
        trait_type: 'domain',
        value: domain.name,
      },
      {
        trait_type: 'level',
        value: domain.levelCount,
      },
      {
        trait_type: 'length',
        value: domain.unicodeName.split('.')[0].length,
      },
    ];

    const currencies = Object.keys(domain.resolution)
      .filter((key) => key.startsWith('crypto') && key.endsWith('address'))
      .map((key) => ({
        trait_type: key.slice('crypto.'.length, key.length - '.address'.length),
        value: domain.resolution[key],
      }))
      .filter((r) => r.value);
    attributes.push(...currencies);

    const ipfsContent =
      domain.resolution['dweb.ipfs.hash'] ||
      domain.resolution['ipfs.html.value'];
    if (ipfsContent) {
      attributes.push({ trait_type: 'IPFS Content', value: ipfsContent });
    }

    return attributes;
  }

  private getAnimalAttributes(domain: Domain): OpenSeaMetadataAttribute[] {
    return this.animalHelper.resellerAnimalAttributes(domain);
  }

  private isDomainWithCustomImage(domain: Domain): boolean {
    const domainsWithCustomImage = [
      'code.crypto',
      'web3.crypto',
      'privacy.crypto',
      'surf.crypto',
      'hosting.crypto',
      'india.crypto',
    ];
    return domainsWithCustomImage.includes(domain.name);
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
    attributes: OpenSeaMetadataAttribute[],
  ): Promise<string> {
    if (this.isDomainWithCustomImage(domain)) {
      return '';
    }

    const animalImage = await this.animalHelper.getResellerAnimalImageData(
      attributes,
    );
    if (animalImage) {
      return animalImage;
    }

    const imagePathFromDomain = domain.resolution['social.image.value'];
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
      } catch (e) {
        // eslint-disable-next-line no-empty
      }
    }
    return this.generateDefaultImageData(domain.label, domain.extension);
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
}
