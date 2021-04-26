import 'reflect-metadata';
import {Get, JsonController, Param} from "routing-controllers"

class DomainResponse {
    meta: {
        domain: string
        owner: string | null
        resolver: string | null
        location: 'CNS' | 'ZNS' | 'UNSL1' | 'UNSL2' | 'UNMINTED'
    } = {
        domain: '',
        owner: null,
        resolver: null,
        location: 'UNMINTED'
    }
    records: Record<string, string> = {}
}

@JsonController()
export class DomainsController {
    @Get('/domains/:domainName')
    async getDomain(@Param('domainName') domainName: string): Promise<DomainResponse> {
        const emptyResponse = new DomainResponse();
        emptyResponse.meta.domain = domainName;
        return emptyResponse;
    }
}
