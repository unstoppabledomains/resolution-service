import { logger } from '../../logger';
import { setIntervalAsync } from 'set-interval-async/dynamic';
import { UnsEvent, Domain, WorkerStatus } from '../../models';
import { env } from '../../env';
import { Contract, Event, BigNumber } from 'ethers';
import { EntityManager, getConnection, Repository } from 'typeorm';
import { UNS } from '../../contracts';
import { eip137Namehash } from '../../utils/namehash';
import { UnsUpdaterError } from '../../errors/UnsUpdaterError';
import { EthereumProvider } from '../EthereumProvider';
import { unwrap } from '../../utils/option';

export class UnsUpdater {
  private registry: Contract = UNS.UNSRegistry.getContract();
  private currentSyncBlock = 0;
  private lastProcessedEvent?: Event;

  static getLatestNetworkBlock(): Promise<number> {
    return EthereumProvider.getBlockNumber();
  }

  static getLatestMirroredBlock(): Promise<number> {
    return WorkerStatus.latestMirroredBlockForWorker('UNSL1');
  }

  private saveLastMirroredBlock(
    blockNumber: number,
    manager: EntityManager,
  ): Promise<void> {
    return WorkerStatus.saveWorkerStatus(
      'UNSL1',
      blockNumber,
      undefined,
      manager.getRepository(WorkerStatus),
    );
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

  private async processTransfer(
    event: Event,
    domainRepository: Repository<Domain>,
  ): Promise<void> {
    const node = UnsEvent.tokenIdToNode(event.args?.tokenId);
    const domain = await Domain.findByNode(node, domainRepository);
    //Check if it's not a new URI
    if (event.args?.from !== Domain.NullAddress) {
      if (!domain) {
        throw new UnsUpdaterError(
          `Transfer event was not processed. Could not find domain for ${node}`,
        );
      }
      //Check if it's a burn
      if (event.args?.to === Domain.NullAddress) {
        domain.ownerAddress = null;
        domain.resolution = {};
        domain.resolver = null;
        await domainRepository.save(domain);
      } else {
        domain.ownerAddress = event.args?.to.toLowerCase();
        await domainRepository.save(domain);
      }
    }
  }

  private async processNewUri(
    event: Event,
    domainRepository: Repository<Domain>,
  ): Promise<void> {
    if (!event.args) {
      throw new UnsUpdaterError(
        `NewUri event wasn't processed. Invalid event args.`,
      );
    }

    const { uri, tokenId } = event.args;
    const expectedNode = eip137Namehash(uri);
    const producedNode = UnsEvent.tokenIdToNode(tokenId);

    //Check if the domain name matches tokenID
    if (expectedNode !== producedNode) {
      throw new UnsUpdaterError(
        `NewUri event wasn't processed. Invalid domain name: ${uri}`,
      );
    }

    //Check if the previous event is "mint" - transfer from 0x0
    if (
      !this.lastProcessedEvent ||
      this.lastProcessedEvent.event !== 'Transfer' ||
      this.lastProcessedEvent.args?.from !== Domain.NullAddress
    ) {
      throw new UnsUpdaterError(
        `NewUri event wasn't processed. Unexpected order of events. Expected last processed event to be 'Transfer', got :'${this.lastProcessedEvent?.event}'`,
      );
    }

    const domain = new Domain();
    domain.attributes({
      name: uri,
      node: eip137Namehash(uri),
      location: 'UNSL1',
      ownerAddress: this.lastProcessedEvent.args?.to.toLowerCase(),
      resolver: Domain.normalizeResolver(this.registry.address),
    });
    await domainRepository.save(domain);
  }

  private async processResetRecords(
    event: Event,
    domainRepository: Repository<Domain>,
  ): Promise<void> {
    const node = UnsEvent.tokenIdToNode(event.args?.tokenId);
    const domain = await Domain.findByNode(node, domainRepository);
    if (!domain) {
      throw new UnsUpdaterError(
        `ResetRecords event was not processed. Could not find domain for ${node}`,
      );
    }
    domain.resolution = {};
    await domainRepository.save(domain);
  }

  private async processSet(
    event: Event,
    domainRepository: Repository<Domain>,
  ): Promise<void> {
    const args = unwrap(event.args);
    // For some reason ethers got a problem with assigning names for this event.
    const [tokenId, , , key, value] = args;
    const node = UnsEvent.tokenIdToNode(tokenId);
    const domain = await Domain.findByNode(node, domainRepository);
    if (!domain) {
      throw new UnsUpdaterError(
        `Set event was not processed. Could not find domain for ${node}`,
      );
    }
    domain.resolution[key] = value;
    await domainRepository.save(domain);
  }

  private async saveEvent(event: Event, manager: EntityManager): Promise<void> {
    const values: Record<string, string> = {};
    Object.entries(event?.args || []).forEach(([key, value]) => {
      values[key] = BigNumber.isBigNumber(value) ? value.toHexString() : value;
    });

    await manager.getRepository(UnsEvent).save(
      new UnsEvent({
        type: event.event as UnsEvent['type'],
        blockNumber: event.blockNumber,
        logIndex: event.logIndex,
        transactionHash: event.transactionHash,
        returnValues: values,
      }),
    );
  }

  private async processEvents(events: Event[], manager: EntityManager) {
    const domainRepository = manager.getRepository(Domain);

    for (const event of events) {
      try {
        logger.debug(
          `Processing event: type - '${event.event}'; args - ${JSON.stringify(
            event.args,
          )}`,
        );
        switch (event.event) {
          case 'Transfer': {
            await this.processTransfer(event, domainRepository);
            break;
          }
          case 'NewURI': {
            await this.processNewUri(event, domainRepository);
            break;
          }
          case 'ResetRecords': {
            await this.processResetRecords(event, domainRepository);
            break;
          }
          case 'Set': {
            await this.processSet(event, domainRepository);
            break;
          }
          case 'Approval':
          case 'ApprovalForAll':
          default:
            break;
        }
        await this.saveEvent(event, manager);
        this.lastProcessedEvent = event;
      } catch (error) {
        if (error instanceof UnsUpdaterError) {
          logger.error(
            `Failed to process UNS event: ${JSON.stringify(
              event,
            )}. Error:  ${error}`,
          );
        }
      }
    }
  }

  public async run(): Promise<void> {
    logger.info('UnsUpdater is pulling updates from Ethereum');
    const fromBlock = Math.max(
      await UnsUpdater.getLatestMirroredBlock(),
      env.APPLICATION.ETHEREUM.UNS_REGISTRY_EVENTS_STARTING_BLOCK,
    );
    const toBlock =
      (await UnsUpdater.getLatestNetworkBlock()) -
      env.APPLICATION.ETHEREUM.UNS_CONFIRMATION_BLOCKS;

    logger.info(
      `[Current network block ${toBlock}]: Syncing mirror from ${fromBlock} to ${toBlock}`,
    );

    if (toBlock < fromBlock) {
      throw new UnsUpdaterError(
        `Sync last block ${toBlock} is less than the current mirror block ${fromBlock}`,
      );
    }

    this.currentSyncBlock = fromBlock;

    while (this.currentSyncBlock < toBlock) {
      const fetchBlock = Math.min(
        this.currentSyncBlock + env.APPLICATION.ETHEREUM.UNS_BLOCK_FETCH_LIMIT,
        toBlock,
      );

      const events = await this.getRegistryEvents(
        this.currentSyncBlock + 1,
        fetchBlock,
      );

      await getConnection().transaction(async (manager) => {
        await this.processEvents(events, manager);
        this.currentSyncBlock = fetchBlock;
        await this.saveLastMirroredBlock(this.currentSyncBlock, manager);
      });
    }
  }
}

export function startWorker(): void {
  setIntervalAsync(async () => {
    try {
      logger.info('UnsUpdater is pulling updates from Ethereum');
      await new UnsUpdater().run();
    } catch (error) {
      logger.error(
        `Unhandled error occured while processing UNS events: ${error}`,
      );
    }
  }, env.APPLICATION.ETHEREUM.UNS_FETCH_INTERVAL);
}
