import {
  Column,
  Entity,
  Index,
  Repository,
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

export const DomainLocations = ['CNS', 'ZNS', 'UNSL1', 'UNSL2', 'UNMINTED'];
export type Location = typeof DomainLocations[number];

@Entity({ name: 'domains' })
export default class Domain extends Model {
  static AddressRegex = /^0x[a-fA-F0-9]{40}$/;
  static NullAddress = '0x0000000000000000000000000000000000000000';

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
    newDomain.attributes({
      name: name,
      node: eip137Namehash(name),
      location: location,
    });
    await repository.save(newDomain);
    return newDomain;
  }
}
