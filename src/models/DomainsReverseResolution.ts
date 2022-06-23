import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { Matches, IsEnum } from 'class-validator';
import { Domain, Model } from '.';
import { Attributes, Blockchain } from '../types/common';
import { ETHAddressRegex } from '../utils/ethersUtils';
import { lowercaseTransformer } from '../database/transformers';

@Entity({ name: 'domains_reverse_resolution' })
@Unique(['domain', 'blockchain', 'networkId'])
@Index(['domain', 'blockchain', 'networkId', 'reverseAddress'])
export default class DomainsReverseResolution extends Model {
  @Matches(ETHAddressRegex) // ensure that the address is lowercase to be consistent
  @Column('text', {
    transformer: lowercaseTransformer,
    comment:
      'unique index, the ethereum address that is configured for reverse resolution',
  })
  @Index()
  reverseAddress: string;

  @IsEnum(Blockchain)
  @Column('text', {
    comment: 'the blockhcain where the reverse resolution came from',
  })
  blockchain: Blockchain;

  @Column('int', {
    comment: 'the networkId where the reverse resolution came from',
  })
  networkId: number; //

  @Column({
    name: 'domain_id',
    comment: 'the reverse resolution domain for this address',
  })
  domainId: number;

  @ManyToOne(() => Domain, (domain) => domain.reverseResolutions, {
    orphanedRowAction: 'delete',
  })
  @JoinColumn({ name: 'domain_id' })
  domain: Domain;

  constructor(attributes?: Attributes<DomainsReverseResolution>) {
    super();
    this.attributes<DomainsReverseResolution>(attributes);
  }
}
