import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { IsOptional, Matches, IsEnum } from 'class-validator';
import { Domain, Model } from '.';
import { Attributes, Blockchain } from '../types/common';

@Entity({ name: 'domains_reverse_resolution' })
@Unique(['domain', 'blockchain', 'networkId'])
@Index(['domain', 'blockchain', 'networkId', 'reverseAddress'])
export default class DomainsReverseResolution extends Model {
  static AddressRegex = /^0x[a-fA-F0-9]{40}$/;

  @Matches(DomainsReverseResolution.AddressRegex)
  @Column('text')
  @Index()
  reverseAddress: string;

  @IsEnum(Blockchain)
  @Column('text')
  blockchain: Blockchain;

  @Column('int')
  networkId: number;

  @ManyToOne(() => Domain, (domain) => domain.reverseResolutions)
  @JoinColumn({ name: 'domain_id' })
  domain: Domain;

  constructor(attributes?: Attributes<DomainsReverseResolution>) {
    super();
    this.attributes<DomainsReverseResolution>(attributes);
  }
}
