import { Get, JsonController } from 'routing-controllers';
import 'reflect-metadata';
import { ResponseSchema } from 'routing-controllers-openapi';
import { IsNumber, ValidateNested } from 'class-validator';

class BlockchainStatus {
  @IsNumber()
  latestNetworkBlock = 0;

  @IsNumber()
  latestMirroredBlock = 0;
}

class StatusResponse {
  @ValidateNested()
  CNS: BlockchainStatus;

  @ValidateNested()
  ZNS: BlockchainStatus;
}

@JsonController()
export class StatusController {
  @Get('/status')
  @ResponseSchema(StatusResponse)
  async getStatus(): Promise<StatusResponse> {
    const statusResponse = new StatusResponse();
    statusResponse.CNS = new BlockchainStatus();
    statusResponse.ZNS = new BlockchainStatus();
    return statusResponse;
  }
}
