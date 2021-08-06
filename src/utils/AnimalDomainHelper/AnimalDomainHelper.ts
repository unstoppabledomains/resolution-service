import * as allAnimals from './vocabulary/animals';
import resellers from './vocabulary/resellers.json';
import adjectives from './vocabulary/adjectives.json';
import fs from 'fs';
import { parse, stringify } from 'svgson';
import { Domain } from '../../models';

const bucketEndpoint =
  'https://storage.googleapis.com/dot-crypto-metadata.appspot.com/images';

export default class AnimalDomainHelper {
  readonly animals: Record<string, string[]> = {};
  readonly adjectives: string[] = [];
  readonly resellers: string[] = [];

  constructor() {
    this.animals = allAnimals;
    this.adjectives = adjectives;
    this.resellers = resellers;
  }

  get animalsFlat(): string[] {
    return Object.values(this.animals).flat();
  }

  resellerAnimalAttributes(
    domain: Domain,
  ): { trait_type: string; value: string }[] {
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
    domain: Domain,
  ): Promise<string | undefined> {
    const matches = this.getResellerAnimalRegex().exec(domain.label);
    if (matches && domain.extension === 'crypto') {
      const prefix = matches[1];
      const animal = matches[2];

      if (animal) {
        return await this.generateImageData(prefix, animal);
      }
    }
    return undefined;
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
    for (const prefix of prefixes) {
      if (!regex.endsWith('(')) {
        regex += '|';
      }
      regex += `${prefix}`;
    }
    regex += ')(';
    for (const animal of this.animalsFlat) {
      if (!regex.endsWith('(')) {
        regex += '|';
      }
      regex += `${animal}`;
    }
    regex += ')[0-9]*$';
    return new RegExp(regex);
  }
}
