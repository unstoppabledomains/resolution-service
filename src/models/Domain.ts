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
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  NotEquals,
} from 'class-validator';
import ValidateWith from '../services/ValidateWith';
import * as _ from 'lodash';
import { Model } from '.';
import { eip137Namehash, znsNamehash } from '../utils/namehash';
import { Attributes } from '../types/common';
import punycode from 'punycode';
import AnimalDomainHelper from '../utils/AnimalDomainHelper/AnimalDomainHelper';
import { getEthConfig } from '../contracts';
import { BlockchainType, Blockchain } from '../utils/constants';

export type Location = {
  networkId: number;
  blockchain: BlockchainType;
};

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

  @IsOptional()
  @Column('text', { nullable: true })
  registry: string | null = null;

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

  @IsNumber()
  @Column('int')
  networkId: number;

  @IsString()
  @Column('text')
  blockchain: BlockchainType;

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

  get unicodeName(): string {
    return punycode.toUnicode(this.name);
  }

  get isUnicodeName(): boolean {
    // eslint-disable-next-line no-control-regex
    return /[^\u0000-\u00ff]/.test(this.name);
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
    if (this.blockchain === Blockchain.ZIL) {
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
    const domain = await repository.findOne({
      name,
      blockchain: location.blockchain,
      networkId: location.networkId,
    });
    if (domain) {
      return domain;
    }

    const newDomain = new Domain();
    // todo Don't prefill domain registry. Set domain registry from incoming ETH events only.
    const registry = this.getRegistryAddressFromLocation(location);
    newDomain.attributes({
      name: name,
      node: eip137Namehash(name),
      blockchain: location.blockchain,
      networkId: location.networkId,
      registry,
    });
    await repository.save(newDomain);
    return newDomain;
  }

  // todo Don't prefill domain registry. Set domain registry from incoming ETH events only.
  static getRegistryAddressFromLocation(location: Location): string {
    if (
      location.blockchain === Blockchain.ETH ||
      location.blockchain === Blockchain.MATIC
    ) {
      const ethConfig = getEthConfig(location.networkId.toString());
      if (this.name.endsWith('.crypto')) {
        return ethConfig.CNSRegistry.address;
      }
      return ethConfig.UNSRegistry.address;
    }
    if (location.blockchain === Blockchain.ZIL) {
      return '0x9611c53be6d1b32058b2747bdececed7e1216793';
    }
    return Domain.NullAddress;
  }
}
