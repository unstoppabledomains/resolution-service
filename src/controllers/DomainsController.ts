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
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { Domain } from '../models';
import { ApiKeyAuthMiddleware } from '../middleware/ApiKeyAuthMiddleware';
import { Blockchain } from '../types/common';
import { toNumber } from 'lodash';
import NetworkConfig from 'uns/uns-config.json';
import { getDomainResolution } from '../services/Resolution';

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
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  owners: string[];

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  page = 1;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(200)
  perPage = 100;

  @IsNotEmpty()
  @IsInt()
  @Min(0)
  startingAfter = 0;
}

class DomainAttributes {
  @IsNotEmpty()
  @IsString()
  id: string;

  @ValidateNested()
  attributes: DomainResponse;
}

class DomainsListMeta {
  @IsNotEmpty()
  @Min(0)
  nextStartingAfter = 0;

  @IsNotEmpty()
  @IsString()
  order: string;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(200)
  perPage = 100;

  @IsNotEmpty()
  @IsBoolean()
  hasMore = false;
}

class DomainsListResponse {
  data: DomainAttributes[];
  meta: DomainsListMeta;
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

    let domains = await Domain.createQueryBuilder('domain')
      .leftJoinAndSelect('domain.resolutions', 'resolution')
      .where('resolution.ownerAddress IN (:...ownerAddress)', {
        ownerAddress: ownersQuery ? ownersQuery : undefined,
      })
      .andWhere('domain.id > :startingAfter', {
        startingAfter: query.startingAfter,
      })
      .orderBy('domain.id', 'ASC')
      .take(query.perPage * 3 + 1)
      .getMany();
    const hasMore = domains.length > query.perPage;
    domains = domains.slice(0, query.perPage);
    const resolutions = domains.map((domain) => ({
      ...getDomainResolution(domain),
      domain,
    }));

    const response = new DomainsListResponse();
    response.data = [];
    for (const resolution of resolutions) {
      response.data.push({
        id: resolution.domain.name,
        attributes: {
          meta: {
            domain: resolution.domain.name,
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
    response.meta = {
      perPage: query.perPage,
      nextStartingAfter: domains.length
        ? domains[domains.length - 1].id || 0
        : 0,
      order: 'id ASC',
      hasMore,
    };
    return response;
  }
}
