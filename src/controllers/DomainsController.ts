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
  owners: string[] | undefined;

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
    const emptyResponse = new DomainResponse();
    emptyResponse.meta = {
      domain: domainName,
      owner: null,
      resolver: null,
      location: 'UNMINTED',
    };
    return emptyResponse;
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
    validateOrReject(query);
    const ownersQuery = query.owners?.map((owner) => owner.toLowerCase());
    console.log(await Domain.find());
    const domains = await Domain.find({
      ownerAddress: ownersQuery ? In(ownersQuery) : undefined,
      location: query.locations ? In(query.locations) : undefined,
    });
    const response = new DomainsListResponse();
    response.data = [];
    for (const domain of domains) {
      response.data.push({
        id: domain.node,
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
