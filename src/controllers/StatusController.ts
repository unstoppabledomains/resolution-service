import { Get, JsonController } from 'routing-controllers';
import 'reflect-metadata';
import { ResponseSchema } from 'routing-controllers-openapi';
import { IsNumber, IsString, ValidateNested } from 'class-validator';
import { WorkerStatus } from '../models';
import ZilProvider from '../workers/zil/ZilProvider';
import { EthereumProvider } from '../workers/EthereumProvider';
import { env } from '../env';

class BlockchainStatus {
  @IsNumber()
  latestNetworkBlock = 0;

  @IsNumber()
  latestMirroredBlock = 0;

  @IsNumber()
  networkId: number;
}

class Blockchains {
  @ValidateNested()
  ETH: BlockchainStatus;

  @ValidateNested()
  ZIL: BlockchainStatus;
}

class StatusResponse {
  @ValidateNested()
  blockchain: Blockchains;
}

@JsonController()
export class StatusController {
  private zilProvider = new ZilProvider();

  @Get('/status')
  @ResponseSchema(StatusResponse)
  async getStatus(): Promise<StatusResponse> {
    const statusResponse = new StatusResponse();
    const blockchain = new Blockchains();
    blockchain.ETH = new BlockchainStatus();
    blockchain.ZIL = new BlockchainStatus();

    blockchain.ETH.latestMirroredBlock = await WorkerStatus.latestMirroredBlockForWorker(
      'ETH',
    );
    blockchain.ETH.latestNetworkBlock = await EthereumProvider.getBlockNumber();

    blockchain.ZIL.latestMirroredBlock = await WorkerStatus.latestMirroredBlockForWorker(
      'ZIL',
    );
    blockchain.ZIL.latestNetworkBlock = (
      await this.zilProvider.getChainStats()
    ).txHeight;

    blockchain.ETH.networkId = env.APPLICATION.ETHEREUM.CHAIN_ID;
    blockchain.ZIL.networkId =
      env.APPLICATION.ZILLIQA.NETWORK === 'mainnet' ? 1 : 333;

    statusResponse.blockchain = blockchain;
    return statusResponse;
  }
}
