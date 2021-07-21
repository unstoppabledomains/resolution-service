import {
  IsEnum,
  IsNumber,
  IsObject,
  IsString,
  Matches,
  Min,
  ValidateIf,
  IsOptional,
} from 'class-validator';
import {
  Column,
  Entity,
  Index,
  MoreThan,
  TableInheritance,
  Not,
} from 'typeorm';
import ValidateWith from '../services/ValidateWith';
import { Attributes } from '../types/common';
import Model from './Model';
import { BigNumber } from '@ethersproject/bignumber';
import { Location, DomainLocations } from './Domain';

export const CnsDomainOperationTypes = [
  'Transfer',
  'Resolve',
  'NewURI',
  'Sync',
];

export const CnsEventTypes = [
  ...CnsDomainOperationTypes,
  'Approval',
  'ApprovalForAll',
  'NewURIPrefix',
];

export const UnsDomainOperationTypes = [
  'Transfer',
  'NewURI',
  'Set',
  'ResetRecords',
];
export const UnsEventTypes = [
  ...UnsDomainOperationTypes,
  'Approval',
  'ApprovalForAll',
  'NewURIPrefix',
] as const;

const EventTypes = [...UnsEventTypes, ...CnsEventTypes] as const;
type EventType = typeof EventTypes[any];

@Entity({ name: 'ethereum_events' })
@TableInheritance({ column: { name: 'location' } })
@Index(['blockNumber', 'logIndex'], { unique: true })
export default abstract class EthereumEvent extends Model {
  static location: Location;

  @IsEnum(DomainLocations)
  @Column('text')
  location: Location;

  @IsEnum(EventTypes)
  @Column({ type: 'text' })
  type: EventType;

  @IsOptional()
  @IsString()
  @Column({ type: 'text', nullable: true })
  blockchainId: string | null = null;

  @IsNumber()
  @ValidateWith<EthereumEvent>('blockNumberIncreases')
  @Column({ type: 'int' })
  @Index()
  blockNumber = 0;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ValidateWith<EthereumEvent>('logIndexForBlockIncreases')
  @Column({ type: 'int', nullable: true })
  logIndex: number | null = null;

  @IsOptional()
  @IsString()
  @Matches(/0x[0-9a-f]+/)
  @ValidateWith<EthereumEvent>('consistentBlockNumberForHash')
  @Column({ type: 'text', nullable: true })
  transactionHash: string | null = null;

  @IsObject()
  @Column({ type: 'json' })
  returnValues: Record<string, string> = {};

  @IsOptional()
  @ValidateIf((e) => e.domainOperation())
  @IsString()
  @Matches(/0x[0-9a-f]+/)
  @Column({ type: 'text', nullable: true })
  @Index()
  node: string | null = null;

  static tokenIdToNode(tokenId: BigNumber): string {
    const node = tokenId.toHexString().replace(/^(0x)?/, '');
    return '0x' + node.padStart(64, '0');
  }

  constructor(attributes?: Attributes<EthereumEvent>) {
    super();
    this.attributes<EthereumEvent>(attributes);
  }

  async blockNumberIncreases(): Promise<boolean> {
    if (this.hasId()) {
      return true;
    }
    return !(await EthereumEvent.findOne({
      blockNumber: MoreThan(this.blockNumber),
    }));
  }

  async logIndexForBlockIncreases(): Promise<boolean> {
    return !(await EthereumEvent.findOne({
      blockNumber: this.blockNumber,
      logIndex: MoreThan(this.logIndex),
    }));
  }

  domainOperation(): boolean {
    if (this.location === 'CNS') {
      return this.type in CnsDomainOperationTypes;
    }
    return this.type in UnsDomainOperationTypes;
  }

  tokenId(): string | undefined {
    return this.returnValues.tokenId;
  }

  async beforeValidate(): Promise<void> {
    const tokenId = this.tokenId();
    this.node = tokenId
      ? EthereumEvent.tokenIdToNode(BigNumber.from(tokenId))
      : null;
  }

  async consistentBlockNumberForHash(): Promise<boolean> {
    const inconsistentEvent = await EthereumEvent.findOne({
      transactionHash: this.transactionHash,
      blockNumber: Not(this.blockNumber),
    });
    return !inconsistentEvent;
  }
}
