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
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { Domain } from '../models';
import { In } from 'typeorm';
import DomainsResolution, {
  DomainLocations,
  Location,
} from '../models/DomainsResolution';
import { ApiKeyAuthMiddleware } from '../middleware/ApiKeyAuthMiddleware';
import { LocationFromDomainName } from '../utils/domainLocationUtils';
import { env } from '../env';

class DomainMetadata {
  @IsString()
  domain: string;

  @IsOptional()
  @IsString()
  owner: string | null = null;

  @IsOptional()
  @IsString()
  resolver: string | null = null;

  @IsEnum(DomainLocations)
  location: Location;

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

  @ArrayNotEmpty()
  @IsNotEmpty({ each: true })
  @IsEnum(DomainLocations, { each: true })
  locations: string[] = DomainLocations;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  page = 1;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(200)
  perPage = 100;
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
  private prepareDomainResponse(domain: Domain): DomainResponse {
    const location = LocationFromDomainName(domain.name);
    let resolution: DomainsResolution;
    if (location === 'ZNS') {
      resolution = domain.getResolution(
        'ZIL',
        env.APPLICATION.ZILLIQA.NETWORK_ID,
      );
    } else {
      resolution = domain.getResolution(
        'ETH',
        env.APPLICATION.ETHEREUM.CHAIN_ID,
      );
    }
    const response = new DomainResponse();
    response.meta = {
      domain: domain.name,
      location: resolution.location,
      owner: resolution.ownerAddress,
      resolver: resolution.resolver,
      registry: resolution.registry,
    };
    response.records = resolution.resolution;
    return response;
  }

  @Get('/domains/:domainName')
  @ResponseSchema(DomainResponse)
  async getDomain(
    @Param('domainName') domainName: string,
  ): Promise<DomainResponse> {
    domainName = domainName.toLowerCase();
    const domain = await Domain.findOne({ name: domainName });
    if (domain) {
      return this.prepareDomainResponse(domain);
    }
    return {
      meta: {
        domain: domainName,
        owner: null,
        resolver: null,
        registry: null,
        location: 'UNMINTED',
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
    const domains = await Domain.find({
      where: {
        ownerAddress: ownersQuery ? In(ownersQuery) : undefined,
        resolutions: {
          location: In(query.locations),
        },
      },
      take: query.perPage,
      skip: (query.page - 1) * query.perPage,
    });
    const response = new DomainsListResponse();
    response.data = [];
    for (const domain of domains) {
      response.data.push({
        id: domain.name,
        attributes: this.prepareDomainResponse(domain),
      });
    }
    return response;
  }
}
