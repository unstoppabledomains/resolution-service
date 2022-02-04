import * as allAnimalsJson from './vocabulary/animals';
import ResellersDictionary from './vocabulary/resellers.json';
import AdjectivesDictionary from './vocabulary/adjectives.json';
import fetch from 'node-fetch';
import { env } from '../../env';

export type OpenSeaMetadataAttribute =
  | { trait_type?: string; value: string | number }
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

const AnimalsDictionary: Record<string, string[]> = allAnimalsJson;
const AnimalsNames: string[] = Object.values(AnimalsDictionary).flat();
const ResellerAnimalRegex = new RegExp(
  `^(${[...AdjectivesDictionary, ...ResellersDictionary].join(
    '|',
  )})?(${AnimalsNames.join('|')})[0-9]*$`,
);
const ImagesEndpoint = `${env.APPLICATION.ERC721_METADATA.GOOGLE_CLOUD_STORAGE_BASE_URL}/images`;

export default class AnimalDomainHelper {
  getAnimalAttributes(name: string): OpenSeaMetadataAttribute[] {
    const attributes: OpenSeaMetadataAttribute[] = [];
    const { prefix, animal } = this.extractPrefixAndAnimal(name);
    if (prefix && AdjectivesDictionary.includes(prefix)) {
      attributes.push({ trait_type: 'adjective', value: prefix });
    }
    if (animal) {
      attributes.push({ trait_type: 'animal', value: animal });
    }
    return attributes;
  }

  async getAnimalImageData(domainName: string): Promise<string | undefined> {
    const imageUrl = this.getAnimalImageUrl(domainName);
    if (imageUrl) {
      const ret = await fetch(imageUrl);
      return ret.text();
    }
  }

  getAnimalImageUrl(domainName: string): string | undefined {
    const { prefix, animal } = this.extractPrefixAndAnimal(domainName);
    if (animal) {
      return this.generateImageUrl(prefix, animal);
    }
    return undefined;
  }

  private generateImageUrl(prefix: string, animal: string): string | undefined {
    const normalizedPrefix = this.normalizePrefix(prefix);
    switch (normalizedPrefix) {
      case 'trust':
      case 'switcheo':
      case 'opera':
      case 'dapp':
      case 'nyc':
      case 'qtum':
      case 'dchat':
      case 'atomic':
      case 'harmony':
      case 'bounty':
      case 'zilliqa':
      case 'equal':
      case 'elja':
      case 'btg': {
        if (!AnimalsDictionary[`${normalizedPrefix}Animals`].includes(animal)) {
          return undefined;
        }
        return ImagesEndpoint + `/${normalizedPrefix}/${animal}.svg`;
      }
      default:
        if (AnimalsDictionary.ethDenverAnimals.includes(animal)) {
          return ImagesEndpoint + `/ethdenver/${animal}.svg`;
        }
        if (AnimalsDictionary.defaultAnimals.includes(animal)) {
          return ImagesEndpoint + `/animals/${animal}.svg`;
        }
        return undefined;
    }
  }

  private normalizePrefix(prefix: string): string {
    const map: Record<string, string> = {
      decentralized: 'dchat',
      awc: 'atomic',
      bnty: 'bounty',
      zil: 'zilliqa',
      eql: 'equal',
      ajoobz: 'elja',
      bitcoingold: 'btg',
    };
    return map[prefix] || prefix;
  }

  private extractPrefixAndAnimal(domainName: string): {
    prefix: string;
    animal: string;
  } {
    let prefix = '';
    let animal = '';
    if (domainName && domainName.includes('.')) {
      const extensionDelimiter = domainName.lastIndexOf('.');
      const label = domainName.slice(0, extensionDelimiter);
      const matches = ResellerAnimalRegex.exec(label);
      if (matches) {
        prefix = matches[1] ?? '';
        animal = matches[2] ?? '';
        return { prefix, animal };
      }
    }
    return { prefix, animal };
  }
}
