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
  @Column('text', { transformer: lowercaseTransformer })
  @Index()
  reverseAddress: string; // unique index, the ethereum address that is configured for reverse resolution

  @IsEnum(Blockchain)
  @Column('text')
  blockchain: Blockchain; // the blockhcain where the reverse resolution came from

  @Column('int')
  networkId: number; // the networkId where the reverse resolution came from

  @ManyToOne(() => Domain, (domain) => domain.reverseResolutions)
  @JoinColumn({ name: 'domain_id' })
  domain: Domain; // the reverse resolution domain for this address

  constructor(attributes?: Attributes<DomainsReverseResolution>) {
    super();
    this.attributes<DomainsReverseResolution>(attributes);
  }
}
