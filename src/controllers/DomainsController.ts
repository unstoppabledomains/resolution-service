import 'reflect-metadata';
import {
  Get,
  JsonController,
  Param,
  QueryParams,
  UseBefore,
} from 'routing-controllers';
import {
  ArrayNotEmpty,
  IsArray,
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
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { Domain } from '../models';
import { In, Raw } from 'typeorm';
import DomainsResolution from '../models/DomainsResolution';
import { ApiKeyAuthMiddleware } from '../middleware/ApiKeyAuthMiddleware';
import { Blockchain } from '../types/common';
import { toNumber } from 'lodash';
import NetworkConfig from 'uns/uns-config.json';
import { getDomainResolution } from '../services/Resolution';
import ValidateWith from '../services/ValidateWith';
import { Attributes } from '../types/common';

class DomainMetadata {
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

class DomainResponse {
  @ValidateNested()
  meta: DomainMetadata;

  @IsObject()
  records: Record<string, string> = {};
}

class DomainsListQuery {
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
  @ValidateWith<DomainsListQuery>('validTlds', {
    message: 'Invalid tld list provided',
  })
  tlds: string[] | undefined = undefined;

  @IsOptional()
  @IsIn(Object.keys(DomainsListQuery.SortFieldsMap))
  sortBy = 'id';

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
      const parent = (
        await Domain.findOne({
          where: { name: tld },
          relations: ['parent'],
        })
      )?.parent;
      val = val && (parent === undefined || parent === null);
    }
    return val;
  }
}

class DomainAttributes {
  @IsString()
  id: string;

  @ValidateNested()
  attributes: DomainResponse;
}

class DomainsListResponse {
  data: DomainAttributes[];
}

@OpenAPI({
  security: [{ apiKeyAuth: [] }],
})
@JsonController()
@UseBefore(ApiKeyAuthMiddleware)
export class DomainsController {
  @Get('/domains/:domainName')
  @ResponseSchema(DomainResponse)
  async getDomain(
    @Param('domainName') domainName: string,
  ): Promise<DomainResponse> {
    domainName = domainName.toLowerCase();
    const domain = await Domain.findOne({
      where: { name: domainName },
      relations: ['resolutions'],
    });
    if (domain) {
      const resolution = getDomainResolution(domain);
      const response = new DomainResponse();
      response.meta = {
        domain: domain.name,
        blockchain: resolution.blockchain,
        networkId: resolution.networkId,
        owner: resolution.ownerAddress,
        resolver: resolution.resolver,
        registry: resolution.registry,
      };
      response.records = resolution.resolution;
      return response;
    }
    return {
      meta: {
        domain: domainName,
        owner: null,
        resolver: null,
        registry: null,
        blockchain: null,
        networkId: null,
      },
      records: {},
    };
  }

  @Get('/domains')
  @OpenAPI({
    responses: {
      '200': {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                data: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/DomainAttributes',
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  async getDomainsList(
    @QueryParams() query: DomainsListQuery,
  ): Promise<DomainsListResponse> {
    const ownersQuery = query.owners.map((owner) => owner.toLowerCase());

    // Use raw query becaues typeorm doesn't seem to handle multiple nested relations (e.g. resolution.domain.parent.name)
    const where = [];
    if (query.tlds) {
      where.push({
        query: `"parent"."name" in (:...tlds)`,
        parameters: { tlds: query.tlds },
      });
    }

    const qb = Domain.createQueryBuilder('domain');
    qb.leftJoinAndSelect('domain.resolutions', 'resolution');
    qb.leftJoinAndSelect('domain.parent', 'parent');
    qb.where(`"resolution"."owner_address" in (:...owners)`, {
      owners: ownersQuery,
    });
    for (const q of where) {
      qb.andWhere(q.query, q.parameters);
    }
    qb.orderBy(query.sort.column, query.sort.direction);
    qb.take(query.perPage + 1);
    qb.skip((query.page - 1) * query.perPage);
    const domains = await qb.getMany();

    const response = new DomainsListResponse();
    response.data = [];
    for (const domain of domains) {
      const resolution = getDomainResolution(domain);
      response.data.push({
        id: domain.name,
        attributes: {
          meta: {
            domain: domain.name,
            blockchain: resolution.blockchain,
            networkId: resolution.networkId,
            owner: resolution.ownerAddress,
            resolver: resolution.resolver,
            registry: resolution.registry,
          },
          records: resolution.resolution,
        },
      });
    }
    return response;
  }
}
