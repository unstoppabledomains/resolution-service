import {
  ArrayNotEmpty,
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
} from 'class-validator';
import { Domain } from '../../models';
import { Blockchain } from '../../types/common';
import { toNumber } from 'lodash';
import NetworkConfig from 'uns/uns-config.json';
import ValidateWith from '../../services/ValidateWith';

export class DomainMetadata {
  @IsString()
  domain: string;

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
  meta: DomainMetadata;

  @IsObject()
  records: Record<string, string> = {};
}

export class DomainsListQuery {
  static SortFieldsMap: Record<string, string> = {
    id: 'domain.id',
    name: 'domain.name',
  };

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  owners: string[];

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @ValidateWith<DomainsListQuery>('validTlds', {
    message: 'Invalid TLD list provided',
  })
  tlds: string[] | undefined = undefined;

  @IsOptional()
  sortBy: 'id' | 'name' = 'id';

  @IsOptional()
  sortDirection: 'ASC' | 'DESC' = 'ASC';

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  page = 1;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(200)
  perPage = 100;

  get sort() {
    return {
      column: DomainsListQuery.SortFieldsMap[this.sortBy],
      direction: this.sortDirection,
    };
  }

  async validTlds(): Promise<boolean> {
    if (this.tlds === undefined) {
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
}

export class DomainAttributes {
  @IsString()
  id: string;

  @ValidateNested()
  attributes: DomainResponse;
}

export class DomainsListResponse {
  data: DomainAttributes[];
}
