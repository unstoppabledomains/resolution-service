import { Column, Entity, Index, ManyToOne, Unique } from 'typeorm';
import {
  IsEnum,
  IsObject,
  IsOptional,
  Matches,
  NotEquals,
} from 'class-validator';
import ValidateWith from '../services/ValidateWith';
import * as _ from 'lodash';
import { Domain, Model } from '.';
import { Attributes } from '../types/common';

export type BlockchainName = 'ETH' | 'ZIL' | 'MATIC';

export const DomainLocations = ['CNS', 'ZNS', 'UNS', 'UNMINTED'];
export type Location = typeof DomainLocations[number];

@Entity({ name: 'domains_resolution' })
@Unique(['id', 'blockchain', 'networkId'])
export default class DomainsResolution extends Model {
  static AddressRegex = /^0x[a-fA-F0-9]{40}$/;
  static NullAddress = '0x0000000000000000000000000000000000000000';

  @Index()
  @IsOptional()
  @Matches(DomainsResolution.AddressRegex)
  @Column('text', { nullable: true })
  ownerAddress: string | null = null;

  @IsOptional()
  @Matches(DomainsResolution.AddressRegex)
  @NotEquals(DomainsResolution.NullAddress)
  @Column('text', { nullable: true })
  resolver: string | null = null;

  @IsOptional()
  @Column('text', { nullable: true })
  registry: string | null = null;

  @IsEnum(DomainLocations)
  @Column('text')
  location: Location;

  @IsOptional()
  @IsObject()
  @ValidateWith<DomainsResolution>('validResolution', {
    message: 'resolution does not match Record<string, string> type',
  })
  @Column('jsonb', { default: {} })
  resolution: Record<string, string> = {};

  @Column('text')
  blockchain: BlockchainName;

  @Column('int')
  networkId: number;

  @ManyToOne(() => Domain, (domain) => domain.resolutions)
  domain: Domain;

  constructor(attributes?: Attributes<DomainsResolution>) {
    super();
    this.attributes<DomainsResolution>(attributes);
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

  static normalizeResolver(resolver: string | null | undefined): string | null {
    if (!resolver) {
      return null;
    }
    resolver = resolver.toLowerCase();
    return resolver === DomainsResolution.NullAddress ? null : resolver;
  }
}
