import { logger } from '../../logger';
import { setIntervalAsync } from 'set-interval-async/dynamic';
import { CnsRegistryEvent, Domain, WorkerStatus } from '../../models';
import { env } from '../../env';
import { Contract, Event, BigNumber } from 'ethers';
import { EntityManager, getConnection, Repository } from 'typeorm';
import { ETHContracts } from '../../contracts';
import { eip137Namehash } from '../../utils/namehash';
import { EthUpdaterError } from '../../errors/EthUpdaterError';
import { EthereumProvider } from '../EthereumProvider';
import { unwrap } from '../../utils/option';
import { CnsResolverError } from '../../errors/CnsResolverError';
import { ExecutionRevertedError } from './BlockchainErrors';
import { CnsResolver } from './CnsResolver';

export class EthUpdater {
  private unsRegistry: Contract = ETHContracts.UNSRegistry.getContract();
  private cnsRegistry: Contract = ETHContracts.CNSRegistry.getContract();
  private cnsResolver: CnsResolver = new CnsResolver();

  private currentSyncBlock = 0;
  private lastProcessedEvent?: Event;

  static getLatestNetworkBlock(): Promise<number> {
    return EthereumProvider.getBlockNumber();
  }

  static getLatestMirroredBlock(): Promise<number> {
    return WorkerStatus.latestMirroredBlockForWorker('ETH');
  }

  private saveLastMirroredBlock(
    blockNumber: number,
    manager: EntityManager,
  ): Promise<void> {
    return WorkerStatus.saveWorkerStatus(
      'ETH',
      blockNumber,
      undefined,
      manager.getRepository(WorkerStatus),
    );
  }

  private async getRegistryEvents(
    fromBlock: number,
    toBlock: number,
  ): Promise<Event[]> {
    const unsEvents = await this.unsRegistry.queryFilter(
      {},
      fromBlock,
      toBlock,
    );
    const cnsEvents = await this.cnsRegistry.queryFilter(
      {},
      fromBlock,
      toBlock,
    );

    // Merge UNS and CNS events and sort them by block number and index.
    const events: Event[] = [...cnsEvents, ...unsEvents];
    events.sort((a, b) => {
      if (a.blockNumber === b.blockNumber) {
        if (a.logIndex === b.logIndex) {
          throw new Error(
            "Pairs of block numbers and log indexes can't be equal",
          );
        }
        return a.logIndex < b.logIndex ? -1 : 1;
      }
      return a.blockNumber < b.blockNumber ? -1 : 1;
    });

    logger.info(
      `Fetched ${
        cnsEvents.length
      } cnsEvents from ${fromBlock} to ${toBlock} by ${
        toBlock - fromBlock + 1
      } `,
    );
    logger.info(
      `Fetched ${
        unsEvents.length
      } unsEvents from ${fromBlock} to ${toBlock} by ${
        toBlock - fromBlock + 1
      } `,
    );
    return events;
  }

  private async processTransfer(
    event: Event,
    domainRepository: Repository<Domain>,
  ): Promise<void> {
    const node = CnsRegistryEvent.tokenIdToNode(event.args?.tokenId);
    const domain = await Domain.findByNode(node, domainRepository);
    //Check if it's not a new URI
    if (event.args?.from !== Domain.NullAddress) {
      if (!domain) {
        throw new EthUpdaterError(
          `Transfer event was not processed. Could not find domain for ${node}`,
        );
      }
      //Check if it's a burn
      if (event.args?.to === Domain.NullAddress) {
        domain.ownerAddress = null;
        domain.resolution = {};
        domain.resolver = null;
        domain.registry = Domain.NullAddress;
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
      throw new EthUpdaterError(
        `NewUri event wasn't processed. Invalid event args.`,
      );
    }

    const { uri, tokenId } = event.args;
    const expectedNode = eip137Namehash(uri);
    const producedNode = CnsRegistryEvent.tokenIdToNode(tokenId);

    //Check if the domain name matches tokenID
    if (expectedNode !== producedNode) {
      throw new EthUpdaterError(
        `NewUri event wasn't processed. Invalid domain name: ${uri}`,
      );
    }

    //Check if the previous event is "mint" - transfer from 0x0
    if (
      !this.lastProcessedEvent ||
      this.lastProcessedEvent.event !== 'Transfer' ||
      this.lastProcessedEvent.args?.from !== Domain.NullAddress
    ) {
      throw new EthUpdaterError(
        `NewUri event wasn't processed. Unexpected order of events. Expected last processed event to be 'Transfer', got :'${this.lastProcessedEvent?.event}'`,
      );
    }

    const domain = await Domain.findOrBuildByNode(producedNode);
    domain.name = uri;
    domain.location = 'CNS';
    domain.ownerAddress = this.lastProcessedEvent.args?.to.toLowerCase();
    domain.registry = this.cnsRegistry.address;

    const contractAddress = event.address.toLowerCase();
    if (contractAddress === ETHContracts.UNSRegistry.address.toLowerCase()) {
      domain.resolver = contractAddress;
      domain.registry = ETHContracts.UNSRegistry.address.toLowerCase();
      domain.location = 'UNSL1';
    }
    await domainRepository.save(domain);
  }

  private async processResetRecords(
    event: Event,
    domainRepository: Repository<Domain>,
  ): Promise<void> {
    const node = CnsRegistryEvent.tokenIdToNode(event.args?.tokenId);
    const domain = await Domain.findByNode(node, domainRepository);
    if (!domain) {
      throw new EthUpdaterError(
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
    const [, , , key, value] = args;
    const tokenId = args[0];
    const node = CnsRegistryEvent.tokenIdToNode(tokenId);
    const domain = await Domain.findByNode(node, domainRepository);
    if (!domain) {
      throw new EthUpdaterError(
        `Set event was not processed. Could not find domain for ${node}`,
      );
    }
    domain.resolution[key] = value;
    await domainRepository.save(domain);
  }

  private async processResolve(
    event: Event,
    domainRepository: Repository<Domain>,
  ): Promise<void> {
    const node = CnsRegistryEvent.tokenIdToNode(event.args?.tokenId);
    const domain = await Domain.findByNode(node, domainRepository);
    if (!domain) {
      throw new EthUpdaterError(
        `Resolve event was not processed. Could not find domain for ${node}`,
      );
    }

    await this.cnsResolver.fetchResolver(domain, domainRepository);
  }

  private async processSync(
    event: Event,
    domainRepository: Repository<Domain>,
  ): Promise<void> {
    const node = CnsRegistryEvent.tokenIdToNode(event.args?.tokenId);
    const domain = await Domain.findByNode(node, domainRepository);
    if (!domain) {
      throw new EthUpdaterError(
        `Sync event was not processed. Could not find domain for node: ${node}`,
      );
    }
    if (event.args?.updateId === undefined) {
      throw new EthUpdaterError(
        `Sync event was not processed. Update id not specified.`,
      );
    }

    const keyHash = event.args?.updateId.toString();
    const resolverAddress = await this.cnsResolver.getResolverAddress(node);
    if (keyHash === '0' || !resolverAddress) {
      domain.resolution = {};
      await domainRepository.save(domain);
      return;
    }

    try {
      const resolutionRecord = await this.cnsResolver.getResolverRecordsByKeyHash(
        resolverAddress,
        keyHash,
        node,
      );
      domain.resolution[resolutionRecord.key] = resolutionRecord.value;
    } catch (error) {
      if (error instanceof CnsResolverError) {
        logger.warn(error);
      } else if (error.message.includes(ExecutionRevertedError)) {
        domain.resolution = {};
      } else {
        throw error;
      }
    }

    await domainRepository.save(domain);
  }

  private async saveEvent(event: Event, manager: EntityManager): Promise<void> {
    const values: Record<string, string> = {};
    Object.entries(event?.args || []).forEach(([key, value]) => {
      values[key] = BigNumber.isBigNumber(value) ? value.toHexString() : value;
    });
    const contractAddress = event.address.toLowerCase();
    await manager.getRepository(CnsRegistryEvent).save(
      new CnsRegistryEvent({
        contractAddress,
        type: event.event as CnsRegistryEvent['type'],
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
          case 'Resolve': {
            await this.processResolve(event, domainRepository);
            break;
          }
          case 'Sync': {
            await this.processSync(event, domainRepository);
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
        if (error instanceof EthUpdaterError) {
          logger.error(
            `Failed to process ETH event: ${JSON.stringify(
              event,
            )}. Error:  ${error}`,
          );
        }
      }
    }
  }

  public async run(): Promise<void> {
    logger.info('EthUpdater is pulling updates from Ethereum');
    const fromBlock = await EthUpdater.getLatestMirroredBlock();
    const toBlock =
      (await EthUpdater.getLatestNetworkBlock()) -
      env.APPLICATION.ETHEREUM.CONFIRMATION_BLOCKS;

    logger.info(
      `[Current network block ${toBlock}]: Syncing mirror from ${fromBlock} to ${toBlock}`,
    );

    if (toBlock < fromBlock) {
      throw new EthUpdaterError(
        `Sync last block ${toBlock} is less than the current mirror block ${fromBlock}`,
      );
    }

    this.currentSyncBlock = fromBlock;

    while (this.currentSyncBlock < toBlock) {
      const fetchBlock = Math.min(
        this.currentSyncBlock + env.APPLICATION.ETHEREUM.BLOCK_FETCH_LIMIT,
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
      logger.info('EthUpdater is pulling updates from Ethereum');
      await new EthUpdater().run();
    } catch (error) {
      logger.error(
        `Unhandled error occured while processing ETH events: ${error}`,
      );
    }
  }, env.APPLICATION.ETHEREUM.FETCH_INTERVAL);
}
