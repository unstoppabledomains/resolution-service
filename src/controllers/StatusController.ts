import { Get, JsonController } from 'routing-controllers';
import 'reflect-metadata';
import { ResponseSchema } from 'routing-controllers-openapi';
import { IsNumber, ValidateNested } from 'class-validator';
import { CnsUpdater } from '../workers/cns/CnsUpdater';
import { ZnsTransaction } from '../models';
import ZnsProvider from '../workers/zns/ZnsProvider';

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
  private znsProvider = new ZnsProvider();

  @Get('/status')
  @ResponseSchema(StatusResponse)
  async getStatus(): Promise<StatusResponse> {
    const statusResponse = new StatusResponse();
    statusResponse.CNS = new BlockchainStatus();
    statusResponse.ZNS = new BlockchainStatus();

    statusResponse.CNS.latestMirroredBlock = await CnsUpdater.getLatestMirroredBlock();
    statusResponse.CNS.latestNetworkBlock = await CnsUpdater.getLatestNetworkBlock();

    statusResponse.ZNS.latestMirroredBlock = await ZnsTransaction.latestAtxuid();
    statusResponse.ZNS.latestNetworkBlock = (
      await this.znsProvider.getChainStats()
    ).txHeight;

    return statusResponse;
  }
}
