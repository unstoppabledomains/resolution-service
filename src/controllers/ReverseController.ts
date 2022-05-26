import { Get, JsonController, Param, UseBefore } from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { DomainResponse } from './dto/Domains';
import {
  getDomainResolution,
  getReverseResolution,
} from '../services/Resolution';
import { ApiKeyAuthMiddleware } from '../middleware/ApiKeyAuthMiddleware';

@OpenAPI({
  security: [{ apiKeyAuth: [] }],
})
@JsonController()
@UseBefore(ApiKeyAuthMiddleware)
export class ReverseController {
  @Get('/reverse/:address')
  @ResponseSchema(DomainResponse)
  async getStatus(@Param('address') address: string): Promise<DomainResponse> {
    address = address.toLowerCase();
    const reverse = await getReverseResolution(address);

    if (reverse) {
      const domain = reverse.domain;
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
        domain: '',
        owner: null,
        resolver: null,
        registry: null,
        blockchain: null,
        networkId: null,
      },
      records: {},
    };
  }
}
