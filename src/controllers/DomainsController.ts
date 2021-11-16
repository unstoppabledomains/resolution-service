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
import { CnsRegistryEvent, Domain } from '../models';
import { In } from 'typeorm';
import DomainsResolution from '../models/DomainsResolution';
import { ApiKeyAuthMiddleware } from '../middleware/ApiKeyAuthMiddleware';
import { Blockchain } from '../types/common';
import { toNumber } from 'lodash';
import NetworkConfig from 'uns/uns-config.json';
import { getDomainResolution } from '../services/Resolution';
import ValidateWith from '../services/ValidateWith';
import { eip137Namehash } from '../utils/namehash';

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
  @IsInt()
  @Min(1)
  page = 1;

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
}

const ensOnZil = new RegExp('[.]zil$');
class UnsDomainQuery {
  @IsString()
  @IsNotEmpty()
  @ValidateWith<UnsDomainQuery>('isNotZilDomain')
  domainName: string;

  isNotZilDomain(): boolean {
    return ensOnZil && !ensOnZil.test(this.domainName);
  }
}

class DomainLatestTransfer {
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
}

class DomainLatestTransfersResponse {
  @ValidateNested()
  blockchains: {
    ETH: DomainLatestTransfer | null;
    MATIC: DomainLatestTransfer | null;
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
      where: {
        ownerAddress: ownersQuery ? In(ownersQuery) : undefined,
        blockchain: In(query.blockchains),
        networkId: In(query.networkIds.map(toNumber)),
      },
      relations: ['domain'],
      take: query.perPage,
      skip: (query.page - 1) * query.perPage,
    });

    if (query.hasDeafultNetworks && query.hasDeafultBlockchains) {
      const uniqueDomains = new Set();
      resolutions = resolutions.filter((res) => {
        const dname = res.domain.name;
        return uniqueDomains.has(dname) ? false : uniqueDomains.add(dname);
      });
      resolutions = resolutions.map((res) => getDomainResolution(res.domain));
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

  @Get('/domains/:domainName/transfers/latest')
  async getDomainsLastTransfer(
    @QueryParams() query: UnsDomainQuery,
  ): Promise<DomainLatestTransfersResponse> {
    const namehash = eip137Namehash(query.domainName);
    const maxBlockNumbersQuery = CnsRegistryEvent.createQueryBuilder('event');
    maxBlockNumbersQuery.addSelect('MAX(event.blockNumber)', 'blockNumber');
    maxBlockNumbersQuery.addSelect('event.blockchain');
    maxBlockNumbersQuery.addSelect('event.node');
    maxBlockNumbersQuery.where(
      `event.node = :namehash AND event.type = :eventType AND event.blockchain <> :excludedBlockchain`,
      {
        namehash,
        eventType: 'Transfer',
        excludedBlockchain: 'ZIL',
      },
    );
    maxBlockNumbersQuery.groupBy('event.blockchain, event.node');
    const maxBlockNumberEvents = await maxBlockNumbersQuery.getMany();
    const lastTransfersQuery = CnsRegistryEvent.createQueryBuilder('event');
    maxBlockNumberEvents.forEach((event: CnsRegistryEvent) => {
      lastTransfersQuery.orWhere(
        `event.blockNumber = :blockNumber AND event.type = :eventType AND node = :namehash AND blockchain = :blockchain`,
        {
          blockNumber: event.blockNumber,
          eventType: 'Transfer',
          namehash,
          blockchain: event.blockchain,
        },
      );
    });
    const lastTransferEvents = await lastTransfersQuery.getMany();
    return lastTransferEvents.reduce((previousValue, currentValue) => {
      previousValue.blockchains[currentValue.blockchain as 'ETH' | 'MATIC'] = {
        blockNumber: currentValue.blockNumber,
        networkId: currentValue.networkId,
        from: currentValue?.returnValues?.from,
        to: currentValue?.returnValues?.to,
      };
      return previousValue;
    }, new DomainLatestTransfersResponse());
  }
}
