import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  Repository,
} from 'typeorm';
import {
  IsObject,
  IsOptional,
  IsString,
  Matches,
  NotEquals,
  IsEnum,
} from 'class-validator';
import ValidateWith from '../services/ValidateWith';
import * as _ from 'lodash';
import { Model } from '.';
import { eip137Namehash, znsNamehash } from '../utils/namehash';
import { Attributes } from '../types/common';
import punycode from 'punycode';
import AnimalDomainHelper from '../utils/AnimalDomainHelper/AnimalDomainHelper';

export const DomainLocations = ['CNS', 'ZNS', 'UNSL1', 'UNSL2', 'UNMINTED'];
export type Location = typeof DomainLocations[number];

@Entity({ name: 'domains' })
export default class Domain extends Model {
  static AddressRegex = /^0x[a-fA-F0-9]{40}$/;
  static NullAddress = '0x0000000000000000000000000000000000000000';
  static AnimalHelper = new AnimalDomainHelper();

  @IsString()
  @ValidateWith<Domain>('nameMatchesNode', {
    message: "Node doesn't match the name",
  })
  @Index({ unique: true })
  @Column('text')
  name: string;

  @Matches(/^0x[a-f0-9]{64}$/)
  @Index({ unique: true })
  @Column('text')
  node: string;

  @Index()
  @IsOptional()
  @Matches(Domain.AddressRegex)
  @Column('text', { nullable: true })
  ownerAddress: string | null = null;

  @IsOptional()
  @Matches(Domain.AddressRegex)
  @NotEquals(Domain.NullAddress)
  @Column('text', { nullable: true })
  resolver: string | null = null;

  @IsString()
  @Column('text', { nullable: true })
  registry: string;

  @IsOptional()
  @Index()
  @ManyToOne((type) => Domain, { nullable: true })
  @JoinColumn()
  parent: Promise<Domain | null>;

  @IsOptional()
  @IsObject()
  @ValidateWith<Domain>('validResolution', {
    message: 'resolution does not match Record<string, string> type',
  })
  @Column('jsonb', { default: {} })
  resolution: Record<string, string> = {};

  @OneToMany((type) => Domain, (domain) => domain.parent)
  @JoinColumn({ name: 'parent_id' })
  children: Promise<Domain[]>;

  @IsEnum(DomainLocations)
  @Column('text')
  location: Location;

  constructor(attributes?: Attributes<Domain>) {
    super();
    this.attributes<Domain>(attributes);
  }

  nameMatchesNode(): boolean {
    return this.correctNode() === this.node;
  }

  validResolution(): boolean {
    for (const property in this.resolution) {
      if (
        !Object.prototype.hasOwnProperty.call(this.resolution, property) ||
        false === _.isString(property) ||
        false === _.isString(this.resolution[property])
      ) {
        return false;
      }
    }

    return true;
  }

  get label(): string {
    const splittedName = this.getSplittedName();
    splittedName.pop();
    return splittedName.join('.');
  }

  get extension(): string {
    return this.getSplittedName().pop() || '';
  }

  get levelCount(): number {
    return this.getSplittedName().length;
  }

  get unicodeName(): string {
    return punycode.toUnicode(this.name);
  }

  get isUnicodeName(): boolean {
    // eslint-disable-next-line no-control-regex
    return /[^\u0000-\u00ff]/.test(this.name);
  }

  get image(): string {
    const DEFAULT_IMAGE_URL = 'https://storage.googleapis.com/dot-crypto-metadata-api/unstoppabledomains_crypto.png' as const;
    const CUSTOM_IMAGE_URL = 'https://storage.googleapis.com/dot-crypto-metadata.appspot.com/images/custom' as const;

    const domainsWithCustomImage: Record<string, string> = {
      'code.crypto': 'code.svg',
      'web3.crypto': 'web3.svg',
      'privacy.crypto': 'privacy.svg',
      'surf.crypto': 'surf.svg',
      'hosting.crypto': 'hosting.svg',
      'india.crypto': 'india.jpg',
    };
    if (domainsWithCustomImage[this.name]) {
      return `${CUSTOM_IMAGE_URL}/${domainsWithCustomImage[this.name]}`;
    }

    const domainAttributes = Domain.AnimalHelper.resellerAnimalAttributes(this);
    const animalAttribute = domainAttributes.find((d) => {
      if ('trait_type' in d) {
        return d.trait_type === 'animal';
      }
    });
    if (animalAttribute) {
      const adjectiveAttribute = domainAttributes.find((d) => {
        if ('trait_type' in d) {
          return d.trait_type === 'adjective';
        }
      });
      const prefix = adjectiveAttribute?.value as string;
      return (
        Domain.AnimalHelper.getAnimalImageUrl(
          prefix,
          animalAttribute.value as string,
        ) ?? ''
      );
    }
    return DEFAULT_IMAGE_URL;
  }

  static async findByNode(
    node?: string,
    repository: Repository<Domain> = this.getRepository(),
  ): Promise<Domain | undefined> {
    return node ? await repository.findOne({ node }) : undefined;
  }

  static async findOrBuildByNode(
    node: string,
    repository: Repository<Domain> = this.getRepository(),
  ): Promise<Domain> {
    return (await repository.findOne({ node })) || new Domain({ node });
  }

  private getSplittedName(): string[] {
    return this.name ? this.name.split('.') : [];
  }

  private correctNode(): string | undefined {
    if (!this.name || this.name !== this.name.toLowerCase()) {
      return undefined;
    }
    if (this.location === 'ZNS') {
      return znsNamehash(this.name);
    }
    return eip137Namehash(this.name);
  }

  static normalizeResolver(resolver: string | null | undefined): string | null {
    if (!resolver) {
      return null;
    }
    resolver = resolver.toLowerCase();
    return resolver === Domain.NullAddress ? null : resolver;
  }

  static async findOrCreateByName(
    name: string,
    location: Location,
    repository: Repository<Domain> = this.getRepository(),
  ): Promise<Domain> {
    const domain = await repository.findOne({ name, location });
    if (domain) {
      return domain;
    }

    const newDomain = new Domain();
    const registry = this.getRegistryAddressFromLocation(location);
    newDomain.attributes({
      name: name,
      node: eip137Namehash(name),
      location: location,
      registry,
    });
    await repository.save(newDomain);
    return newDomain;
  }

  static getRegistryAddressFromLocation(location: string): string {
    switch (location) {
      case 'CNS':
        return '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe';
      case 'ZNS':
        return '0x9611c53be6d1b32058b2747bdececed7e1216793';
      case 'UNSL1':
        return '0x049aba7510f45ba5b64ea9e658e342f904db358d';
      default:
        return Domain.NullAddress;
    }
  }
}
