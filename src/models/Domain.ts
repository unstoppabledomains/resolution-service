import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import {
  IsObject,
  IsOptional,
  IsString,
  Matches,
  NotEquals,
} from 'class-validator';
import ValidateWith from '../services/ValidateWith';
import * as _ from 'lodash';
import { Resolution } from '@unstoppabledomains/resolution';
import { Model } from '.';

type DomainLocation = 'CNS' | 'ZNS' | 'UNSL1' | 'UNSL2' | 'UNMINTED';

@Entity({ name: 'domains' })
export default class Domain extends Model {
  static AddressRegex = /^0x[a-f0-9]{40}$/;
  static NullAddress = '0x0000000000000000000000000000000000000000';
  private static Resolution = new Resolution();

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

  @Column('text')
  location: DomainLocation;

  nameMatchesNode() {
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

  private getSplittedName(): string[] {
    return this.name ? this.name.split('.') : [];
  }

  private correctNode() {
    if (!this.name || this.name !== this.name.toLowerCase()) {
      return undefined;
    }
    return Domain.Resolution.isSupportedDomain(this.name)
      ? Domain.Resolution.namehash(this.name)
      : undefined;
  }
}
