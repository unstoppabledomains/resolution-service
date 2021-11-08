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

  @IsArray()
  @IsOptional()
  @ValidateWith<DomainsListQuery>('validTlds')
  tlds: string[] | undefined = undefined;

  @IsOptional()
  sortBy:
    | Record<keyof Attributes<Domain>, 'ASC' | 'DESC'>
    | undefined = undefined;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  page = 1;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(200)
  perPage = 100;

  get hasDeafultBlockchains(): boolean {
    return Object.values(Blockchain).reduce(
      (val: boolean, elem) => val && this.blockchains.includes(elem),
      true,
    );
  }

  get hasDeafultNetworks(): boolean {
    return Object.keys(NetworkConfig.networks).reduce(
      (val: boolean, elem) => val && this.networkIds.includes(elem),
      true,
    );
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

    const where: any = {};
    if (ownersQuery) {
      where.ownerAddress = In(ownersQuery);
    }
    if (!query.hasDeafultBlockchains) {
      where.blockchain = In(query.blockchains);
    }
    if (!query.hasDeafultNetworks) {
      where.networkId = In(query.networkIds.map(toNumber));
    }
    if (query.tlds) {
      // Use raw query becaues typeorm doesn't seem to handle multiple nested relations (e.g. resolution.domain.parent.name)
      where.domain = Raw(
        (alias) => `"DomainsResolution__domain__parent"."name" in (:...tlds)`,
        { tlds: query.tlds },
      );
    }

    let resolutions = await DomainsResolution.find({
      where,
      order: query.sortBy || { domain: 'ASC' },
      relations: ['domain', 'domain.parent'],
      take: query.perPage + 1,
      skip: (query.page - 1) * query.perPage,
    });

    if (query.hasDeafultNetworks && query.hasDeafultBlockchains) {
      const uniqueDomains = new Set<string>();
      resolutions = resolutions.filter((res) => {
        const dname = res.domain.name;
        return uniqueDomains.has(dname) ? false : uniqueDomains.add(dname);
      });
      // Pull domains from DB because typeorm doesn't fill cyclic relations (e.g. domain->resolution->domain)
      const domains = await Domain.find({
        where: { name: In(Array.from(uniqueDomains)) },
        relations: ['resolutions'],
      });
      resolutions = domains.map((d) => {
        const res = getDomainResolution(d);
        res.domain = d;
        return res;
      });
    }

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
    return response;
  }
}
