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
import { In, MoreThan } from 'typeorm';
import DomainsResolution from '../models/DomainsResolution';
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

  @IsArray()
  @ArrayNotEmpty()
  @IsNotEmpty({ each: true })
  @IsIn(Object.keys(NetworkConfig.networks), { each: true })
  networkIds: string[] = Object.keys(NetworkConfig.networks);

  @IsArray()
  @ArrayNotEmpty()
  @IsNotEmpty({ each: true })
  @IsIn(Object.values(Blockchain), { each: true })
  blockchains: string[] = Object.values(Blockchain);

  @IsNotEmpty()
  startingAfter = 0;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(200)
  perPage = 100;

  get hasDeafultBlockchains(): boolean {
    return this.blockchains === Object.values(Blockchain);
  }

  get hasDeafultNetworks(): boolean {
    return this.networkIds === Object.keys(NetworkConfig.networks);
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
  meta: {
    nextStartingAfter: string;
    perPage: number;
    order: string;
    hasMore: boolean;
  };
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
    let resolutions = await DomainsResolution.find({
      // todo This should be Domains.find instead of DomainsResolution.find
      where: {
        ownerAddress: ownersQuery ? In(ownersQuery) : undefined,
        // blockchain: In(query.blockchains),             // todo Lets remove these filters
        // networkId: In(query.networkIds.map(toNumber)), // todo Lets remove these filters
        id: MoreThan(query.startingAfter), // if order in DESC - use LessThan() operator instead. If query.startingAfter = null - don't add this condition.
      },
      relations: ['domain'],
      take: query.perPage * 3 + 1, // To include potential duplicates with resolutions from different networks and to fill hasMore field
      order: {
        id: 'ASC',
      },
    });

    // if (query.hasDeafultNetworks && query.hasDeafultBlockchains) {
    const uniqueDomains = new Set();
    resolutions = resolutions.filter((res) => {
      const dname = res.domain.name;
      return uniqueDomains.has(dname) ? false : uniqueDomains.add(dname);
    });
    resolutions = resolutions.map((res) => getDomainResolution(res.domain));
    // }

    const hasMore = resolutions.length > query.perPage;
    // Take first N domains from resolutions array (query.perPage) and put them into DomainsListResponse
    resolutions = resolutions.slice(0, query.perPage);

    const response = new DomainsListResponse();
    response.data = [];
    response.meta = {
      perPage: query.perPage,
      nextStartingAfter: String(resolutions[resolutions.length - 1].id),
      order: 'id ASC',
      hasMore,
    };

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
    return response;
  }
}
