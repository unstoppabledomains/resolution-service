import * as allAnimalsJson from './vocabulary/animals';
import ResellersDictionary from './vocabulary/resellers.json';
import AdjectivesDictionary from './vocabulary/adjectives.json';
import fetch from 'node-fetch';
import { Domain } from '../../models';
import { env } from '../../env';

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

const AnimalsDictionary: Record<string, string[]> = allAnimalsJson;
const AnimalsNames: string[] = Object.values(AnimalsDictionary).flat();
const ResellerAnimalRegex = new RegExp(
  `^(${[...AdjectivesDictionary, ...ResellersDictionary].join(
    '|',
  )})?(${AnimalsNames.join('|')})[0-9]*$`,
);
const ImagesEndpoint = `${env.APPLICATION.ERC721_METADATA.GOOGLE_CLOUD_STORAGE_BASE_URL}/images`;

export default class AnimalDomainHelper {
  resellerAnimalAttributes(name: string): OpenSeaMetadataAttribute[] {
    const splitname = name.split('.');
    const extension = splitname.pop();
    const label = splitname.join('.');
    if (extension !== 'crypto') {
      return [{ trait_type: 'type', value: 'standard' }];
    }
    const attributes: { trait_type: string; value: string }[] = [];
    const matches = ResellerAnimalRegex.exec(label);
    if (matches) {
      const prefix = matches[1];
      const animal = matches[2];
      if (AdjectivesDictionary.includes(prefix)) {
        attributes.push({ trait_type: 'adjective', value: prefix });
      }
      attributes.push({ trait_type: 'animal', value: animal });
      attributes.push({ trait_type: 'type', value: 'animal' });
    } else {
      attributes.push({ trait_type: 'type', value: 'standard' });
    }
    return attributes;
  }

  async getResellerAnimalImageData(
    attributes: OpenSeaMetadataAttribute[],
  ): Promise<string | undefined> {
    const imageUrl = this.getResellerAnimalImageUrl(attributes);
    if (imageUrl) {
      const ret = await fetch(imageUrl);
      return ret.text();
    }
  }

  getResellerAnimalImageUrl(
    attributes: OpenSeaMetadataAttribute[],
  ): string | undefined {
    let domain = '';
    let prefix = '';
    let animal = '';

    attributes.forEach((attribute) => {
      if ('trait_type' in attribute) {
        domain =
          attribute.trait_type === 'domain'
            ? (attribute.value as string)
            : domain;
        prefix =
          attribute.trait_type === 'adjective'
            ? (attribute.value as string)
            : prefix;
        animal =
          attribute.trait_type === 'animal'
            ? (attribute.value as string)
            : animal;
      }
    });
    if (animal) {
      return this.getAnimalImageUrl(prefix, animal);
    }
    return undefined;
  }

  getAnimalImageUrl(prefix: string, animal: string): string | undefined {
    switch (this.normalizePrefix(prefix)) {
      case 'trust':
        return `${ImagesEndpoint}/unstoppabledomains_crypto.png`;
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
        if (!AnimalsDictionary[`${prefix}Animals`].includes(animal)) {
          return undefined;
        }
        return ImagesEndpoint + `/${prefix}/${animal}.svg`;
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
      aws: 'atomic',
      bnty: 'bounty',
      zil: 'zilliqa',
      eql: 'equal',
      ajoobz: 'elja',
      bitcoingold: 'btg',
    };
    return map[prefix] || prefix;
  }
}
