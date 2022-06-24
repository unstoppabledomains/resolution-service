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
  async getReverse(@Param('address') address: string): Promise<DomainResponse> {
    const reverse = await getReverseResolution(address);
    const response = new DomainResponse();
    if (reverse) {
      const domain = reverse.domain;
      const resolution = getDomainResolution(domain);
      response.meta = {
        domain: domain.name,
        blockchain: resolution.blockchain,
        networkId: resolution.networkId,
        owner: resolution.ownerAddress,
        resolver: resolution.resolver,
        registry: resolution.registry,
      };
      response.records = resolution.resolution;
    }

    return response;
  }
}
