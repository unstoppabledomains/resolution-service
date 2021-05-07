import 'reflect-metadata';
import { Get, JsonController, Param, QueryParams } from 'routing-controllers';
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
  validateOrReject,
} from 'class-validator';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { Domain } from '../models';
import { In } from 'typeorm';
import { logger } from '../logger';

const DomainLocations = ['CNS', 'ZNS', 'UNSL1', 'UNSL2', 'UNMINTED'];
type Location = typeof DomainLocations[number];

class DomainMetadata {
  @IsString()
  domain!: string;

  @IsOptional()
  @IsString()
  owner: string | null = null;

  @IsOptional()
  @IsString()
  resolver: string | null = null;

  @IsEnum(DomainLocations)
  location!: Location;
}

class DomainResponse {
  @ValidateNested()
  meta!: DomainMetadata;

  @IsObject()
  records: Record<string, string> = {};
}

class DomainsListQuery {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  owners!: string[];

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
  id!: string;

  @ValidateNested()
  attributes!: DomainResponse;
}

class DomainsListResponse {
  data!: DomainAttributes[];
}

@JsonController()
export class DomainsController {
  @Get('/domains/:domainName')
  @ResponseSchema(DomainResponse)
  async getDomain(
    @Param('domainName') domainName: string,
  ): Promise<DomainResponse> {
    domainName = domainName.toLowerCase();
    logger.info(`Resolving ${domainName} via database`);
    const domain = await Domain.findOne({ name: domainName });
    if (domain) {
      const response = new DomainResponse();
      response.meta = {
        domain: domainName,
        location: domain.location,
        owner: domain.ownerAddress,
        resolver: domain.resolver,
      };
      response.records = domain.resolution;
      logger.debug(response);
      return response;
    }
    return {
      meta: {
        domain: domainName,
        owner: null,
        resolver: null,
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
        location: In(query.locations),
      },
      take: query.perPage,
      skip: (query.page - 1) * query.perPage,
    });
    const response = new DomainsListResponse();
    response.data = [];
    for (const domain of domains) {
      response.data.push({
        id: domain.name,
        attributes: {
          meta: {
            location: domain.location,
            owner: domain.ownerAddress,
            resolver: domain.resolver,
            domain: domain.name,
          },
          records: domain.resolution,
        },
      });
    }
    return response;
  }
}
