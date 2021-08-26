import * as allAnimals from './vocabulary/animals';
import resellers from './vocabulary/resellers.json';
import adjectives from './vocabulary/adjectives.json';
import fs from 'fs';
import fetch from 'node-fetch';
import { parse, stringify } from 'svgson';
import { Domain } from '../../models';
import { OpenSeaMetadataAttribute } from '../../controllers/MetaDataController';

const bucketEndpoint =
  'https://storage.googleapis.com/dot-crypto-metadata.appspot.com/images';

export default class AnimalDomainHelper {
  readonly animals: Record<string, string[]> = allAnimals;
  readonly adjectives: string[] = adjectives;
  readonly resellers: string[] = resellers;

  get animalsFlat(): string[] {
    return Object.values(this.animals).flat();
  }

  resellerAnimalAttributes(domain: Domain): OpenSeaMetadataAttribute[] {
    if (domain.extension !== 'crypto') {
      return [{ trait_type: 'type', value: 'standard' }];
    }
    const attributes: { trait_type: string; value: string }[] = [];
    const matches = this.getResellerAnimalRegex().exec(domain.label);
    if (matches) {
      const prefix = matches[1];
      const animal = matches[2];
      if (this.adjectives.includes(prefix)) {
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
    const extension = domain.split('.').pop();
    if (extension === 'crypto') {
      if (animal) {
        return await this.generateImageData(prefix, animal);
      }
    }
    return undefined;
  }

  getAnimalImageUrl(prefix: string, animal: string): string | undefined {
    switch (this.normalizePrefix(prefix)) {
      case 'trust':
        return 'https://storage.googleapis.com/dot-crypto-metadata-api/unstoppabledomains_crypto.png';
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
        if (!this.animals[`${prefix}Animals`].includes(animal)) {
          return undefined;
        }
        return bucketEndpoint + `/${prefix}/${animal}.svg`;
      }
      default:
        if (this.animals.ethDenverAnimals.includes(animal)) {
          return bucketEndpoint + `/ethdenver/${animal}.svg`;
        }
        if (this.animals.defaultAnimals.includes(animal)) {
          return bucketEndpoint + `/animals/${animal}.svg`;
        }
        return undefined;
    }
  }

  private async generateImageData(
    prefix: string,
    animal: string,
  ): Promise<string | undefined> {
    switch (this.normalizePrefix(prefix)) {
      case 'trust':
        return this.generateTrustAnimalImageData(animal);
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
      case 'btg':
        return this.safeGetImageDataFromBucket(prefix, animal);
      default:
        if (this.animals.ethDenverAnimals.includes(animal)) {
          return this.getImageDataFromBucket('ethdenver', animal);
        }
        if (this.animals.defaultAnimals.includes(animal)) {
          return this.getImageDataFromBucket('animals', animal);
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

  private async safeGetImageDataFromBucket(
    prefix: string,
    animal: string,
  ): Promise<string | undefined> {
    if (!this.animals[`${prefix}Animals`].includes(animal)) {
      return undefined;
    }
    return this.getImageDataFromBucket(prefix, animal);
  }

  private async getImageDataFromBucket(
    prefix: string,
    animal: string,
  ): Promise<string> {
    const ret = await fetch(bucketEndpoint + `/${prefix}/${animal}.svg`);
    return await ret.text();
  }

  //todo move these pictures to the bucket and use safeGetImageDataFromBucket instead
  private async generateTrustAnimalImageData(animal: string) {
    const animalSvg = fs.readFileSync(
      __dirname + `/trustAnimals/${animal}.svg`,
      'utf8',
    );
    const logo = fs.readFileSync(__dirname + `/trustAnimals/logo.svg`, 'utf8');
    const parsedAnimal = await parse(animalSvg);
    const parsedLogo = await parse(logo);
    parsedAnimal.children.push(parsedLogo);
    return stringify(parsedAnimal);
  }

  private getResellerAnimalRegex(): RegExp {
    const prefixes = [...this.adjectives, ...this.resellers];
    let regex = '^(';
    regex += prefixes.join('|');
    regex += ')?(';
    regex += this.animalsFlat.join('|');
    regex += ')[0-9]*$';
    return new RegExp(regex);
  }
}
