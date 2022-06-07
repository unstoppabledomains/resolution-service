import { Get, JsonController } from 'routing-controllers';
import 'reflect-metadata';
import { ResponseSchema } from 'routing-controllers-openapi';
import { IsBoolean, IsNumber, ValidateNested } from 'class-validator';
import { Domain, WorkerStatus } from '../models';
import ZilProvider from '../workers/zil/ZilProvider';
import { env } from '../env';
import * as ethersUtils from '../utils/ethersUtils';
import { EthereumProvider, MaticProvider } from '../workers/EthereumProvider';
import { Blockchain, UnstoppableDomainTlds } from '../types/common';

class BlockchainStatus {
  @IsBoolean()
  isUpToDate: boolean;

  @IsNumber()
  latestNetworkBlock = 0;

  @IsNumber()
  latestMirroredBlock = 0;

  @IsNumber()
  networkId: number;

  @IsNumber()
  acceptableDelayInBlocks: number;
}

class Blockchains {
  @ValidateNested()
  ETH: BlockchainStatus;

  @ValidateNested()
  MATIC: BlockchainStatus;

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

  private static async blockchainStatusForNetwork(
    blockchain: Blockchain,
    config: {
      NETWORK_ID: number;
      ACCEPTABLE_DELAY_IN_BLOCKS: number;
      CONFIRMATION_BLOCKS: number;
    },
    latestBlockCallback: () => Promise<number>,
  ): Promise<BlockchainStatus> {
    const status: BlockchainStatus = {
      latestMirroredBlock: await WorkerStatus.latestMirroredBlockForWorker(
        blockchain,
      ),
      latestNetworkBlock: await latestBlockCallback(),
      networkId: config.NETWORK_ID,
      acceptableDelayInBlocks: config.ACCEPTABLE_DELAY_IN_BLOCKS,
      isUpToDate: false,
    };
    status.isUpToDate =
      status.latestNetworkBlock - status.latestMirroredBlock <=
      status.acceptableDelayInBlocks + config.CONFIRMATION_BLOCKS;
    return status;
  }

  @Get('/status')
  @ResponseSchema(StatusResponse)
  async getStatus(): Promise<StatusResponse> {
    const statusResponse = new StatusResponse();
    const blockchain = new Blockchains();
    blockchain.ETH = await StatusController.blockchainStatusForNetwork(
      Blockchain.ETH,
      env.APPLICATION.ETHEREUM,
      () => {
        return ethersUtils.getLatestNetworkBlock(EthereumProvider);
      },
    );
    blockchain.MATIC = await StatusController.blockchainStatusForNetwork(
      Blockchain.MATIC,
      env.APPLICATION.POLYGON,
      () => {
        return ethersUtils.getLatestNetworkBlock(MaticProvider);
      },
    );
    blockchain.ZIL = await StatusController.blockchainStatusForNetwork(
      Blockchain.ZIL,
      env.APPLICATION.ZILLIQA,
      async () => {
        return (await this.zilProvider.getChainStats()).txHeight;
      },
    );

    statusResponse.blockchain = blockchain;
    return statusResponse;
  }

  @Get('/liveness_check')
  async livenessCheck(): Promise<{ status: string }> {
    await Domain.findOne();
    return { status: 'ok' };
  }

  @Get('/readiness_check')
  async readinessCheck(): Promise<{ status: string }> {
    await Domain.findOne();
    return { status: 'ok' };
  }

  @Get('/supported_tlds')
  listSupportedTlds(): { tlds: Array<string> } {
    return { tlds: Object.values(UnstoppableDomainTlds) };
  }
}
