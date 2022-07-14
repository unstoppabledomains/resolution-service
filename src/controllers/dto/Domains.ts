import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  IsNumber,
  ValidateNested,
  IsIn,
  ArrayMaxSize,
} from 'class-validator';
import { Domain } from '../../models';
import { Blockchain } from '../../types/common';
import { toNumber } from 'lodash';
import NetworkConfig from 'uns/uns-config.json';
import ValidateWith from '../../services/ValidateWith';
import { JSONSchema } from 'class-validator-jsonschema';
import SupportedKeysJson from 'uns/resolver-keys.json';

// Need to specity types explicitly because routing-controllers gets easily confused
/* eslint-disable @typescript-eslint/no-inferrable-types */

export class DomainMetadata {
  @IsString()
  domain: string = '';

  @IsOptional()
  @IsString()
  owner: string | null = null;

  @IsOptional()
  @IsString()
  resolver: string | null = null;

  @IsOptional()
  @IsString()
  @IsIn(Object.values(Blockchain), { each: true })
  blockchain: keyof typeof Blockchain | null = null;

  @IsOptional()
  @IsNumber()
  @IsIn(Object.keys(NetworkConfig.networks).map(toNumber))
  networkId: number | null = null;

  @IsOptional()
  @IsString()
  registry: string | null = null;
}

export class DomainResponse {
  @ValidateNested()
  meta: DomainMetadata = new DomainMetadata();

  @IsObject()
  records: Record<string, string> = {};
}

export class DomainRecords {
  @IsString()
  domain: string;

  @IsObject()
  records: Record<string, string> = {};
}

export interface SortField {
  sortBy: string[];
  getNextStartingAfterValue: (t: Domain) => string | undefined;
}

export class DomainsListQuery {
  static SortFieldsMap: Record<string, SortField> = {
    id: {
      sortBy: ['domain.id'],
      getNextStartingAfterValue: (t) => t.id?.toString(),
    },
    name: {
      sortBy: ['domain.name'],
      getNextStartingAfterValue: (t) => t.name?.toString(),
    },
    created_at: {
      sortBy: ['domain.createdAt', 'domain.id'],
      getNextStartingAfterValue: (t) =>
        `${t.createdAt?.toISOString()}|${t.id?.toString()}`,
    },
  };

  @IsOptional()
  @IsObject()
  @ValidateWith<DomainsListQuery>('verifyRecords', {
    message: 'Invalid resolution records provided',
  })
  @JSONSchema({
    $ref: '', // custom validators mess with the schema generator so we have to set an empty ref to avoid errors
  })
  resolution: Record<string, string> | null;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  owners: string[] | null;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @ValidateWith<DomainsListQuery>('validTlds', {
    message: 'Invalid TLD list provided',
  })
  @JSONSchema({
    $ref: '', // custom validators mess with the schema generator so we have to set an empty ref to avoid errors
  })
  tlds: string[] | null;

  @IsOptional()
  @IsIn(Object.keys(DomainsListQuery.SortFieldsMap))
  sortBy: 'id' | 'name' | 'created_at' = 'id';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortDirection: 'ASC' | 'DESC' = 'ASC';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  perPage: number = 100;

  @IsOptional()
  startingAfter: string = '';

  get sort() {
    return {
      columns: DomainsListQuery.SortFieldsMap[this.sortBy].sortBy,
      direction: this.sortDirection,
    };
  }

  nextStargingAfter(domain: Domain | undefined) {
    return domain
      ? DomainsListQuery.SortFieldsMap[this.sortBy].getNextStartingAfterValue(
          domain,
        )
      : undefined;
  }

  async validTlds(): Promise<boolean> {
    if (!this.tlds || this.tlds.length == 0) {
      return true;
    }
    let val = true;
    for (const tld of this.tlds) {
      const parent = await Domain.findOne({
        where: { name: tld },
        relations: ['parent'],
      });
      val = val && parent !== undefined && parent.parent === null;
    }
    return val;
  }

  verifyRecords(): boolean {
    for (const property in this.resolution) {
      if (
        !Object.prototype.hasOwnProperty.call(this.resolution, property) ||
        !(
          property != null &&
          typeof property.valueOf() === 'string' &&
          Object.prototype.hasOwnProperty.call(SupportedKeysJson.keys, property)
        ) ||
        !(
          this.resolution[property] != null &&
          typeof this.resolution[property].valueOf() === 'string'
        )
      ) {
        return false;
      }
    }
    return true;
  }
}

export class DomainAttributes {
  @IsString()
  id: string;

  @ValidateNested()
  attributes: DomainResponse;
}

export class DomainsListMeta {
  @IsNotEmpty()
  @IsString()
  nextStartingAfter: string;

  @IsNotEmpty()
  @IsString()
  sortBy: string;

  @IsNotEmpty()
  @IsString()
  sortDirection: string;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(200)
  perPage = 100;

  @IsNotEmpty()
  @IsBoolean()
  hasMore = false;
}

export class DomainsListResponse {
  data: DomainAttributes[];
  meta: DomainsListMeta;
}

export class UnsDomainQuery {
  @IsString()
  @IsNotEmpty()
  domainName: string;
}

export class DomainLatestTransfer {
  @IsString()
  domain: string;

  @IsString()
  @IsNotEmpty()
  from: string;

  @IsString()
  @IsNotEmpty()
  to: string;

  @IsInt()
  @IsNotEmpty()
  networkId: number;

  @IsInt()
  @IsNotEmpty()
  blockNumber: number;

  @IsString()
  @IsNotEmpty()
  blockchain: string;
}

export class DomainLatestTransferResponse {
  @ValidateNested()
  data: DomainLatestTransfer[];
}

export class DomainsRecordsQuery {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @ArrayMaxSize(50)
  domains: string[];

  @IsOptional()
  @ValidateWith<DomainsRecordsQuery>('containsSupportedKey', {
    message: 'Unsupported Unstoppable Domains key',
  })
  key: string;

  containsSupportedKey(): boolean {
    return Object.keys(SupportedKeysJson.keys).includes(this.key);
  }
}

export class DomainsRecordsResponse {
  @ValidateNested()
  data: DomainRecords[];
}
