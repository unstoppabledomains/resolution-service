import { Get, JsonController } from 'routing-controllers';
import 'reflect-metadata';
import { ResponseSchema } from 'routing-controllers-openapi';
import { IsBoolean, IsNumber, ValidateNested } from 'class-validator';
import { Domain, WorkerStatus } from '../models';
import ZilProvider from '../workers/zil/ZilProvider';
import { env } from '../env';
import * as ethersUtils from '../utils/ethersUtils';
import { EthereumProvider, MaticProvider } from '../workers/EthereumProvider';
import { Blockchain } from '../types/common';

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

  @Get('/status')
  @ResponseSchema(StatusResponse)
  async getStatus(): Promise<StatusResponse> {
    const statusResponse = new StatusResponse();
    const blockchain = new Blockchains();
    blockchain.ETH = new BlockchainStatus();
    blockchain.MATIC = new BlockchainStatus();
    blockchain.ZIL = new BlockchainStatus();

    blockchain.ETH.latestMirroredBlock = await WorkerStatus.latestMirroredBlockForWorker(
      Blockchain.ETH,
    );
    blockchain.ETH.latestNetworkBlock = await ethersUtils.getLatestNetworkBlock(
      EthereumProvider,
    );
    blockchain.ETH.networkId = env.APPLICATION.ETHEREUM.NETWORK_ID;
    blockchain.ETH.acceptableDelayInBlocks =
      env.APPLICATION.ETHEREUM.ACCEPTABLE_DELAY_IN_BLOCKS;
    blockchain.ETH.isUpToDate =
      blockchain.ETH.latestNetworkBlock - blockchain.ETH.latestMirroredBlock <=
      blockchain.ETH.acceptableDelayInBlocks;

    blockchain.MATIC.latestMirroredBlock = await WorkerStatus.latestMirroredBlockForWorker(
      Blockchain.MATIC,
    );
    blockchain.MATIC.latestNetworkBlock = await ethersUtils.getLatestNetworkBlock(
      MaticProvider,
    );
    blockchain.MATIC.networkId = env.APPLICATION.POLYGON.NETWORK_ID;
    blockchain.MATIC.acceptableDelayInBlocks =
      env.APPLICATION.POLYGON.ACCEPTABLE_DELAY_IN_BLOCKS;
    blockchain.MATIC.isUpToDate =
      blockchain.MATIC.latestNetworkBlock -
        blockchain.MATIC.latestMirroredBlock <=
      blockchain.MATIC.acceptableDelayInBlocks;

    blockchain.ZIL.latestMirroredBlock = await WorkerStatus.latestMirroredBlockForWorker(
      Blockchain.ZIL,
    );
    blockchain.ZIL.latestNetworkBlock = (
      await this.zilProvider.getChainStats()
    ).txHeight;
    blockchain.ZIL.networkId = env.APPLICATION.ZILLIQA.NETWORK_ID;
    blockchain.ZIL.acceptableDelayInBlocks =
      env.APPLICATION.ZILLIQA.ACCEPTABLE_DELAY_IN_BLOCKS;
    blockchain.ZIL.isUpToDate =
      blockchain.ZIL.latestNetworkBlock - blockchain.ZIL.latestMirroredBlock <=
      blockchain.ZIL.acceptableDelayInBlocks;

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
}
