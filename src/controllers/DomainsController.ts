import 'reflect-metadata';
import {Get, JsonController, Param, QueryParams} from "routing-controllers"
import {ArrayNotEmpty, IsArray, IsEnum, IsInt, IsNotEmpty, IsString, Max, Min} from "class-validator";

const DomainLocations = ['CNS', 'ZNS', 'UNSL1', 'UNSL2', 'UNMINTED'];
type Location = typeof DomainLocations[number];

class DomainResponse {
    meta: {
        domain: string
        owner: string | null
        resolver: string | null
        location: Location
    } = {
        domain: '',
        owner: null,
        resolver: null,
        location: 'UNMINTED'
    }

    records: Record<string, string> = {}
}

class DomainsListQuery {
    @IsArray()
    @ArrayNotEmpty()
    @IsString({each: true})
    @IsNotEmpty({each: true})
    owners: string[] | undefined;

    @ArrayNotEmpty()
    @IsNotEmpty({each: true})
    @IsEnum(DomainLocations, {each: true})
    locations: string[] = DomainLocations;

    @IsNotEmpty()
    @IsInt()
    @Min(1)
    page: number = 1;

    @IsNotEmpty()
    @IsInt()
    @Min(1)
    @Max(200)
    perPage: number = 100;
}

class DomainsListResponse {
    data: Array<{
        id: string,
        attributes: DomainResponse
    }> = []
}

@JsonController()
export class DomainsController {
    @Get('/domains/:domainName')
    async getDomain(@Param('domainName') domainName: string): Promise<DomainResponse> {
        const emptyResponse = new DomainResponse();
        emptyResponse.meta.domain = domainName;
        return emptyResponse;
    }

    @Get('/domains')
    async getDomainsList(@QueryParams() query: DomainsListQuery): Promise<DomainsListResponse> {
        return new DomainsListResponse();
    }
}
