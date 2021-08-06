import { Get, JsonController, Param } from 'routing-controllers';
import { ResponseSchema } from 'routing-controllers-openapi';
import { eip137Namehash, znsNamehash } from '../utils/namehash';
import Domain from '../models/Domain';
import AnimalDomainHelper from '../utils/AnimalDomainHelper/AnimalDomainHelper';

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
  attributes?: Array<OpenSeaMetadataAttribute>;
  background_color?: string;
  animation_url?: string;
  youtube_url?: string;
}

@JsonController()
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
      metadata.image_data = await this.generateImageData(domain);
      metadata.background_color = '4C47F7';
    }

    if (!this.isValidDNSDomain(domain.name)) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      metadata.attributes!.push({ value: 'invalid' });
    }

    if (domain.isUnicodeName) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      metadata.attributes!.push({
        value: 'unicode',
      });
    }

    return metadata;
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
    const ipfsHash = records['ipfs.html.value'] || records['dweb.ipfs.hash'];
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
      domain.resolution['ipfs.html.value'] ||
      domain.resolution['dweb.ipfs.hash'];
    if (ipfsContent) {
      attributes.push({ trait_type: 'IPFS Content', value: ipfsContent });
    }

    return attributes;
  }

  private getAnimalAttributes(domain: Domain): OpenSeaMetadataAttribute[] {
    return this.animalHelper.resellerAnimalAttributes(domain);
  }

  private isDomainWithCustomImage(domain: Domain): boolean {
    // todo find a better way to determine such domains. Flag in database?
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

  private async generateImageData(domain: Domain): Promise<string> {
    if (
      domain.name === 'code.crypto' ||
      domain.name === 'web3.crypto' ||
      domain.name === 'privacy.crypto' ||
      domain.name === 'surf.crypto' ||
      domain.name === 'hosting.crypto'
    ) {
      return '';
    }

    const animalImage = await this.animalHelper.getResellerAnimalImageData(
      domain,
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
    let fontSize = 24;
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
    const fontFamily =
      "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Ubuntu, 'Helvetica Neue', Oxygen, Cantarell, sans-serif";

    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="250px" height="250px" viewBox="0 0 250 250" version="1.1">
  <!-- Generator: Sketch 61 (89581) - https://sketch.com -->
  <title>unstoppabledomains_dot_crypto-</title>
  <desc>Created with Sketch.</desc>
  <g id="unstoppabledomains" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
      <rect fill="#4C47F7" x="0" y="0" width="100%" height="100%"/>
      <g id="Group-6" transform="translate(70.000000, 154.000000)">
          <g id="Group" transform="translate(5.000000, 43.000000)">
          <rect x="${tld === 'blockchain' ? -26 : 0}" y="0" width="${
      tld === 'blockchain' ? 150 : 100
    }" height="34" stroke="#2FE9FF" stroke-width="2.112px" rx="17"/>
              <text  dominant-baseline="middle" text-anchor="middle" font-size="16" font-weight="bold" fill="#FFFFFF" font-family="${fontFamily}"> <tspan x="19%" y="20">.${tld.toUpperCase()}</tspan></text>
          </g>
          <text text-anchor="middle" id="domain" font-family="${fontFamily}" font-size="${fontSize}" font-weight="bold" fill="#FFFFFF">
              <tspan x="22.5%" y="26">${label}</tspan>
          </text>
      </g>
      <g id="sign" transform="translate(56.000000, 19.000000)">
          <polygon id="Rectangle-Copy-3" fill="#2FE9FF" points="137.000268 2.12559903 137.000268 48.8887777 -2.72848394e-13 104.154352"/>
          <path d="M111.312718,-1.42108539e-14 L111.312718,80.7727631 C111.312718,104.251482 92.1448713,123.284744 68.5001341,123.284744 C44.855397,123.284744 25.6875503,104.251482 25.6875503,80.7727631 L25.6875503,46.7631786 L51.3751006,32.734225 L51.3751006,80.7727631 C51.3751006,88.9903146 58.0838469,95.6519563 66.3595049,95.6519563 C74.6351629,95.6519563 81.3439093,88.9903146 81.3439093,80.7727631 L81.3439093,16.3671125 L111.312718,-1.42108539e-14 Z" id="Path" fill="#FFFFFF"/>
      </g>
  </g>
</svg>`;
  }
}
