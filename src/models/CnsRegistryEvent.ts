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
import { Column, Entity, Index, MoreThan, Not } from 'typeorm';
import ValidateWith from '../services/ValidateWith';
import { Attributes } from '../types/common';
import Model from './Model';
import { BigNumber } from '@ethersproject/bignumber';
import { CNS, UNS } from '../contracts';

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
const DomainOperationTypes = [
  ...UnsDomainOperationTypes,
  ...CnsDomainOperationTypes,
] as const;

type EventType = typeof EventTypes[any];

@Entity({ name: 'cns_registry_events' })
@Index(['blockNumber', 'logIndex'], { unique: true })
export default class CnsRegistryEvent extends Model {
  static EventTypes = EventTypes;
  static DomainOperationTypes = DomainOperationTypes;

  @Column('text')
  contractAddress: string;

  @IsEnum(EventTypes)
  @Column({ type: 'text' })
  type: EventType;

  @IsOptional()
  @IsString()
  @Column({ type: 'text', nullable: true })
  blockchainId: string | null = null;

  @IsNumber()
  @ValidateWith<CnsRegistryEvent>('blockNumberIncreases')
  @Column({ type: 'int' })
  @Index()
  blockNumber = 0;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ValidateWith<CnsRegistryEvent>('logIndexForBlockIncreases')
  @Column({ type: 'int', nullable: true })
  logIndex: number | null = null;

  @IsOptional()
  @IsString()
  @Matches(/0x[0-9a-f]+/)
  @ValidateWith<CnsRegistryEvent>('consistentBlockNumberForHash')
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

  constructor(attributes?: Attributes<CnsRegistryEvent>) {
    super();
    this.attributes<CnsRegistryEvent>(attributes);
  }

  async blockNumberIncreases(): Promise<boolean> {
    if (this.hasId()) {
      return true;
    }
    return !(await CnsRegistryEvent.findOne({
      blockNumber: MoreThan(this.blockNumber),
    }));
  }

  async logIndexForBlockIncreases(): Promise<boolean> {
    return !(await CnsRegistryEvent.findOne({
      blockNumber: this.blockNumber,
      logIndex: MoreThan(this.logIndex),
    }));
  }

  domainOperation(): boolean {
    if (
      this.contractAddress ===
      UNS.UNSRegistry.getContract().address.toLowerCase()
    ) {
      return this.type in UnsDomainOperationTypes;
    }
    if (
      this.contractAddress === CNS.Registry.getContract().address.toLowerCase()
    ) {
      return this.type in CnsDomainOperationTypes;
    }
    return false;
  }

  tokenId(): string | undefined {
    return this.returnValues.tokenId;
  }

  async beforeValidate(): Promise<void> {
    const tokenId = this.tokenId();
    this.node = tokenId
      ? CnsRegistryEvent.tokenIdToNode(BigNumber.from(tokenId))
      : null;
  }

  async consistentBlockNumberForHash(): Promise<boolean> {
    const inconsistentEvent = await CnsRegistryEvent.findOne({
      transactionHash: this.transactionHash,
      blockNumber: Not(this.blockNumber),
    });
    return !inconsistentEvent;
  }
}
