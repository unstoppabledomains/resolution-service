import 'reflect-metadata';
import {
  Get,
  JsonController,
  Param,
  Params,
  QueryParams,
  UseBefore,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { CnsRegistryEvent, Domain } from '../models';
import { ApiKeyAuthMiddleware } from '../middleware/ApiKeyAuthMiddleware';
import { getDomainResolution, IsZilDomain } from '../services/Resolution';
import { eip137Namehash, znsNamehash } from '../utils/namehash';
import {
  DomainResponse,
  DomainsListQuery,
  DomainsListResponse,
  UnsDomainQuery,
  DomainLatestTransferResponse,
  DomainsRecordsQuery,
  DomainsRecordsResponse,
  DomainRecords,
} from './dto/Domains';
import { ConvertArrayQueryParams } from '../middleware/ConvertArrayQueryParams';
import { In } from 'typeorm';
import _ from 'lodash';
import { normalizeDomainName, normalizeDomainOrToken } from '../utils/domain';

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
  @UseBefore(ConvertArrayQueryParams('owners'))
  @UseBefore(ConvertArrayQueryParams('tlds'))
  async getDomainsList(
    @QueryParams() query: DomainsListQuery,
  ): Promise<DomainsListResponse> {
    // Use raw query becaues typeorm doesn't seem to handle multiple nested relations (e.g. resolution.domain.parent.name)
    const where = [];
    if (query.tlds) {
      where.push({
        query: `"parent"."name" in (:...tlds)`,
        parameters: { tlds: query.tlds },
      });
    }

    if (query.resolution) {
      const resolutionKeys = Object.keys(query.resolution);
      for (let i = 0; i < resolutionKeys.length; i++) {
        const key = Object.keys(query.resolution)[i];
        where.push({
          query: `"resolution"."resolution"->>'${key}' = :val${i}`,
          parameters: { [`val${i}`]: query.resolution[key] },
        });
      }
    }

    if (query.startingAfter.length !== 0) {
      const startingVals = query.startingAfter.split('|');
      if (startingVals.length !== query.sort.columns.length) {
        throw new Error('Invalid startingAfter value ' + query.startingAfter);
      }
      for (let i = 0; i < query.sort.columns.length; i++) {
        where.push({
          query: `${query.sort.columns[i]} ${
            query.sort.direction === 'ASC' ? '>' : '<'
          } :startingAfter${i}`,
          parameters: { [`startingAfter${i}`]: startingVals[i] },
        });
      }
    }

    if (query.owners) {
      const ownersQuery = query.owners.map((owner) => owner.toLowerCase());
      where.push({
        query: `"resolution"."owner_address" in (:...owners)`,
        parameters: {
          owners: ownersQuery,
        },
      });
    }

    const qb = Domain.createQueryBuilder('domain');
    qb.leftJoinAndSelect('domain.resolutions', 'resolution');
    qb.leftJoinAndSelect('domain.parent', 'parent');
    qb.where(`1 = 1`);
    for (const q of where) {
      qb.andWhere(q.query, q.parameters);
    }
    for (const c of query.sort.columns) {
      qb.addOrderBy(c, query.sort.direction);
    }
    qb.take(query.perPage + 1);
    const domains = await qb.getMany();
    const hasMore = domains.length > query.perPage;
    if (hasMore) {
      domains.pop();
    }
    const lastDomain =
      domains.length !== 0 ? domains[domains.length - 1] : undefined;

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

    response.meta = {
      perPage: query.perPage,
      nextStartingAfter:
        query.nextStargingAfter(lastDomain) || query.startingAfter || '',
      sortBy: query.sortBy,
      sortDirection: query.sortDirection,
      hasMore,
    };
    return response;
  }

  @Get('/domains/:domainName/transfers/latest')
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
                    $ref: '#/components/schemas/DomainLatestTransfer',
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  async getDomainsLastTransfer(
    @Params() query: UnsDomainQuery,
  ): Promise<DomainLatestTransferResponse> {
    const tokenId = eip137Namehash(query.domainName);
    const domainEvents = await CnsRegistryEvent.createQueryBuilder();
    domainEvents.select();
    domainEvents.distinctOn(['blockchain']);
    domainEvents.where({
      node: tokenId,
      blockchain: In(['ETH', 'MATIC']),
      type: 'Transfer',
    });
    domainEvents.orderBy({
      blockchain: 'ASC',
      block_number: 'DESC',
      log_index: 'DESC',
    });
    const lastTransferEvents = await domainEvents.getMany();

    const response = new DomainLatestTransferResponse();
    response.data = lastTransferEvents.map((event) => {
      return {
        domain: query.domainName,
        from: event?.returnValues?.from,
        to: event?.returnValues?.to,
        networkId: event.networkId,
        blockNumber: event.blockNumber,
        blockchain: event.blockchain,
      };
    });
    return response;
  }

  @Get('/records')
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
                    $ref: '#/components/schemas/DomainRecords',
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  @UseBefore(ConvertArrayQueryParams('domains'))
  async getDomainsRecords(
    @QueryParams() query: DomainsRecordsQuery,
  ): Promise<DomainsRecordsResponse> {
    const domainNames = query.domains.map(normalizeDomainName);
    const tokens = domainNames.map(normalizeDomainOrToken);
    const domains = await Domain.findAllByNodes(tokens);
    const zilTokens = domainNames
      .filter(
        (name) => IsZilDomain(name) && !domains.some((d) => d.name === name),
      )
      .map(znsNamehash);
    const zilDomains = await Domain.findAllByNodes(zilTokens);
    const allDomains = domains.concat(zilDomains);
    const domainsRecords: DomainRecords[] = [];

    for (const domainName of domainNames) {
      const domain = allDomains.find((d) => d.name === domainName);

      if (domain) {
        const { resolution } = getDomainResolution(domain);
        const records = query.key ? _.pick(resolution, query.key) : resolution;
        domainsRecords.push({ domain: domainName, records });
      } else {
        domainsRecords.push({ domain: domainName, records: {} });
      }
    }

    return { data: domainsRecords };
  }
}
