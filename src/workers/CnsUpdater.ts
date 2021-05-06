import { logger } from '../logger';
import { setIntervalAsync } from 'set-interval-async/dynamic';
import { provider } from '../utils/provider';
import { CnsRegistryEvent } from '../models';
import { env } from '../env';
import * as _ from 'lodash';
import { ethers, Contract, Event, EventFilter, BigNumber } from 'ethers';
import {
  EntityManager,
  getConnection,
  getRepository,
  Repository,
} from 'typeorm';
import { CNS } from '../contracts';

export class CNSMirrorWorker {
  private registry: Contract = CNS.Registry.getContract();
  private currentSyncBlock = 0;

  private async getLatestNetworkBlock() {
    return await provider.getBlockNumber();
  }

  private async getLatestMirroredBlock(): Promise<number> {
    return await CnsRegistryEvent.latestBlock();
  }

  private async getRegistryEvents(
    fromBlock: number,
    toBlock: number,
  ): Promise<Event[]> {
    const data = await this.registry.queryFilter({}, fromBlock, toBlock);
    logger.info(
      `Fetched ${data.length} events from ${fromBlock} to ${toBlock} by ${
        toBlock - fromBlock + 1
      } `,
    );
    return data;
  }

  private async processEvents(events: Event[], manager: EntityManager) {
    for (const event of events) {
      logger.info(event.topics);
    }
  }

  public async run() {
    logger.info('CnsUpdater is pulling updates from Ethereum');
    const fromBlock = await this.getLatestMirroredBlock();
    const toBlock =
      (await this.getLatestNetworkBlock()) -
      env.APPLICATION.ETHEREUM.CNS_CONFIRMATION_BLOCKS;

    logger.info(
      `[Current network block ${toBlock}]: Syncing mirror from ${fromBlock} to ${toBlock}`,
    );

    if (toBlock < fromBlock) {
      throw new Error(
        `Sync last block ${toBlock} is less than the current mirror block ${fromBlock}`,
      );
    }

    this.currentSyncBlock = fromBlock;

    while (this.currentSyncBlock < toBlock) {
      const fetchBlock = _.min([
        this.currentSyncBlock + env.APPLICATION.ETHEREUM.CNS_BLOCK_FETCH_LIMIT,
        toBlock,
      ])!;

      const events = await this.getRegistryEvents(
        this.currentSyncBlock + 1,
        fetchBlock,
      );

      await getConnection().transaction(async (manager) => {
        await this.processEvents(events, manager);
        this.currentSyncBlock = fetchBlock;
      });
    }
  }
}

setIntervalAsync(async () => {
  try {
    logger.info('CnsUpdater is pulling updates from Ethereum');
    const mirror = new CNSMirrorWorker();
    await mirror.run();
  } catch (error) {
    logger.info(error);
  }
}, 5000);
