import { Get, JsonController } from 'routing-controllers';
import 'reflect-metadata';
import { ResponseSchema } from 'routing-controllers-openapi';
import { IsNumber, IsString, ValidateNested } from 'class-validator';
import { WorkerStatus } from '../models';
import ZnsProvider from '../workers/zns/ZnsProvider';
import { EthereumProvider } from '../workers/EthereumProvider';
import { env } from '../env';
import chainIdToNetworkName from '../utils/chainIdToNetworkName';

class BlockchainStatus {
  @IsNumber()
  latestNetworkBlock = 0;

  @IsNumber()
  latestMirroredBlock = 0;

  @IsString()
  network: string;
}

class StatusResponse {
  @ValidateNested()
  ETH: BlockchainStatus;

  @ValidateNested()
  ZIL: BlockchainStatus;
}

@JsonController()
export class StatusController {
  private znsProvider = new ZnsProvider();

  @Get('/status')
  @ResponseSchema(StatusResponse)
  async getStatus(): Promise<StatusResponse> {
    const statusResponse = new StatusResponse();
    statusResponse.ETH = new BlockchainStatus();
    statusResponse.ZIL = new BlockchainStatus();

    statusResponse.ETH.latestMirroredBlock = await WorkerStatus.latestMirroredBlockForWorker(
      'ETH',
    );
    statusResponse.ETH.latestNetworkBlock = await EthereumProvider.getBlockNumber();

    statusResponse.ZIL.latestMirroredBlock = await WorkerStatus.latestMirroredBlockForWorker(
      'ZIL',
    );
    statusResponse.ZIL.latestNetworkBlock = (
      await this.znsProvider.getChainStats()
    ).txHeight;

    statusResponse.ETH.network =
      chainIdToNetworkName[env.APPLICATION.ETHEREUM.CHAIN_ID];
    statusResponse.ZIL.network = env.APPLICATION.ZILLIQA.NETWORK;

    return statusResponse;
  }
}
