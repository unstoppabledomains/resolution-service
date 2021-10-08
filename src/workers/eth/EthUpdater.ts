import { logger } from '../../logger';
import { setIntervalAsync } from 'set-interval-async/dynamic';
import { CnsRegistryEvent, Domain, WorkerStatus } from '../../models';
import { env } from '../../env';
import { Contract, Event, BigNumber, ethers } from 'ethers';
import { EntityManager, getConnection, Repository } from 'typeorm';
import { ETHContracts } from '../../contracts';
import { eip137Namehash } from '../../utils/namehash';
import { EthUpdaterError } from '../../errors/EthUpdaterError';
import { EthereumProvider } from '../../workers/EthereumProvider';
import { unwrap } from '../../utils/option';
import { CnsResolverError } from '../../errors/CnsResolverError';
import { ExecutionRevertedError } from './BlockchainErrors';
import { CnsResolver } from './CnsResolver';
import * as ethersUtils from '../../utils/ethersUtils';
import { BlockchainName } from '../../models/DomainsResolution';

export class EthUpdater {
  private unsRegistry: Contract = ETHContracts.UNSRegistry.getContract();
  private cnsRegistry: Contract = ETHContracts.CNSRegistry.getContract();
  private cnsResolver: CnsResolver = new CnsResolver();
  readonly blockchain: BlockchainName = 'ETH';
  readonly networkId: number = env.APPLICATION.ETHEREUM.CHAIN_ID;

  private currentSyncBlock = 0;
  private currentSyncBlockHash = '';

  static async getLatestNetworkBlock(): Promise<number> {
    return (
      (await ethersUtils.getLatestNetworkBlock()) -
      env.APPLICATION.ETHEREUM.CONFIRMATION_BLOCKS
    );
  }

  static getLatestMirroredBlock(): Promise<number> {
    return WorkerStatus.latestMirroredBlockForWorker('ETH');
  }

  static getLatestMirroredBlockHash(): Promise<string | undefined> {
    return WorkerStatus.latestMirroredBlockHashForWorker('ETH');
  }

  private async saveLastMirroredBlock(manager: EntityManager): Promise<void> {
    return WorkerStatus.saveWorkerStatus(
      'ETH',
      this.currentSyncBlock,
      this.currentSyncBlockHash,
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
      const resolution = domain.getResolution(this.blockchain, this.networkId);

      //Check if it's a burn
      if (event.args?.to === Domain.NullAddress) {
        resolution.ownerAddress = null;
        resolution.resolution = {};
        resolution.resolver = null;
        resolution.registry = null;
        domain.setResolution(resolution);
        await domainRepository.save(domain);
      } else {
        resolution.ownerAddress = event.args?.to.toLowerCase();
        await domainRepository.save(domain);
      }
    }
  }

  private async processNewUri(
    event: Event,
    lastProcessedEvent: Event | undefined,
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
      !lastProcessedEvent ||
      lastProcessedEvent.event !== 'Transfer' ||
      lastProcessedEvent.args?.from !== Domain.NullAddress
    ) {
      throw new EthUpdaterError(
        `NewUri event wasn't processed. Unexpected order of events. Expected last processed event to be 'Transfer', got :'${lastProcessedEvent?.event}'`,
      );
    }

    const domain = await Domain.findOrBuildByNode(producedNode);

    const resolution = domain.getResolution(this.blockchain, this.networkId);

    domain.name = uri;
    resolution.location = 'CNS';
    resolution.ownerAddress = lastProcessedEvent.args?.to.toLowerCase();
    resolution.registry = this.cnsRegistry.address;

    const contractAddress = event.address.toLowerCase();
    if (contractAddress === this.unsRegistry.address.toLowerCase()) {
      resolution.resolver = contractAddress;
      resolution.registry = this.unsRegistry.address.toLowerCase();
      resolution.location = 'UNS';
    }
    domain.setResolution(resolution);
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

    const resolution = domain.getResolution(this.blockchain, this.networkId);
    resolution.resolution = {};
    domain.setResolution(resolution);
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
    const resolution = domain.getResolution(this.blockchain, this.networkId);
    resolution.resolution[key] = value;
    domain.setResolution(resolution);
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
    const resolution = domain.getResolution(this.blockchain, this.networkId);
    await this.cnsResolver.fetchResolver(domain, resolution, domainRepository);
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

    const resolution = domain.getResolution(this.blockchain, this.networkId);

    const keyHash = event.args?.updateId.toString();
    const resolverAddress = await this.cnsResolver.getResolverAddress(node);
    if (keyHash === '0' || !resolverAddress) {
      resolution.resolution = {};
      domain.setResolution(resolution);
      await domainRepository.save(domain);
      return;
    }

    try {
      const resolutionRecord = await this.cnsResolver.getResolverRecordsByKeyHash(
        resolverAddress,
        keyHash,
        node,
      );
      resolution.resolution[resolutionRecord.key] = resolutionRecord.value;
    } catch (error: unknown) {
      if (error instanceof CnsResolverError) {
        logger.warn(error);
      } else if (
        error instanceof Error &&
        error.message.includes(ExecutionRevertedError)
      ) {
        resolution.resolution = {};
      } else {
        throw error;
      }
    }

    domain.setResolution(resolution);
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
        blockHash: event.blockHash,
        logIndex: event.logIndex,
        transactionHash: event.transactionHash,
        returnValues: values,
      }),
    );
  }

  private async processEvents(
    events: Event[],
    manager: EntityManager,
    save = true,
  ) {
    const domainRepository = manager.getRepository(Domain);
    let lastProcessedEvent: Event | undefined = undefined;
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
            await this.processNewUri(
              event,
              lastProcessedEvent,
              domainRepository,
            );
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
        if (save) {
          await this.saveEvent(event, manager);
        }
        lastProcessedEvent = event;
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

  private async findLastMatchingBlock(): Promise<{
    blockNumber: number;
    blockHash: string;
  }> {
    const latestEventBlocks = await CnsRegistryEvent.latestEventBlocks(
      env.APPLICATION.ETHEREUM.MAX_REORG_SIZE,
    );

    // Check first and last blocks as edge cases
    const [firstNetBlock, lastNetBlock] = await Promise.all([
      EthereumProvider.getBlock(latestEventBlocks[0].blockNumber),
      EthereumProvider.getBlock(
        latestEventBlocks[latestEventBlocks.length - 1].blockNumber,
      ),
    ]);

    // If the oldest event block doesn't match, the reorg must be too long.
    if (firstNetBlock.hash !== latestEventBlocks[0].blockHash) {
      throw new EthUpdaterError(
        `Detected reorg that is larger than ${env.APPLICATION.ETHEREUM.MAX_REORG_SIZE} blocks. Manual resync is required.`,
      );
    }

    // Latest event block != last mirrored block. There could be blocks without events during the reorg.
    if (
      lastNetBlock.hash ===
      latestEventBlocks[latestEventBlocks.length - 1].blockHash
    ) {
      return latestEventBlocks[latestEventBlocks.length - 1];
    }

    // Binary search for reorg start
    let searchReorgFrom = 0;
    let searchReorgTo = latestEventBlocks.length - 1;
    while (searchReorgTo - searchReorgFrom > 1) {
      const mid =
        searchReorgFrom + Math.floor((searchReorgTo - searchReorgFrom) / 2);
      const ourBlock = latestEventBlocks[mid];
      const netBlock = await EthereumProvider.getBlock(ourBlock.blockNumber);
      if (ourBlock.blockHash !== netBlock.hash) {
        searchReorgTo = mid;
      } else {
        searchReorgFrom = mid;
      }
    }
    return latestEventBlocks[searchReorgFrom];
  }

  private async rebuildDomainFromEvents(
    tokenId: string,
    manager: EntityManager,
  ) {
    const domain = await Domain.findByNode(tokenId);

    logger.debug(`Rebuilding domain ${domain?.name} from db events`);
    const domainEvents = await CnsRegistryEvent.find({
      where: { node: tokenId },
      order: { blockNumber: 'ASC', logIndex: 'ASC' },
    });
    const convertedEvents: Event[] = [];
    for (const event of domainEvents) {
      const tmpEvent = {
        blockNumber: event.blockNumber,
        blockHash: event.blockHash,
        logIndex: event.logIndex,
        event: event.type,
        args: event.returnValues as Record<string, any>,
        address: event.contractAddress,
      };
      tmpEvent.args.tokenId = BigNumber.from(tokenId);
      convertedEvents.push(tmpEvent as Event);
    }
    await domain?.remove();
    await this.processEvents(convertedEvents, manager, false);
  }

  private async handleReorg(): Promise<number> {
    const reorgStartingBlock = await this.findLastMatchingBlock();
    await WorkerStatus.saveWorkerStatus(
      'ETH',
      reorgStartingBlock.blockNumber,
      reorgStartingBlock.blockHash,
    );

    await getConnection().transaction(async (manager) => {
      const cleanUp = await CnsRegistryEvent.cleanUpEvents(
        reorgStartingBlock.blockNumber,
        manager.getRepository(CnsRegistryEvent),
      );

      const promises: Promise<void>[] = [];
      for (const tokenId of cleanUp.affected) {
        promises.push(this.rebuildDomainFromEvents(tokenId, manager));
      }
      await Promise.all(promises);

      logger.warn(
        `Deleted ${cleanUp.deleted} events after reorg and reverted ${cleanUp.affected.size} domains`,
      );
    });

    return reorgStartingBlock.blockNumber;
  }

  private async syncBlockRanges(): Promise<{
    fromBlock: number;
    toBlock: number;
  }> {
    const latestMirrored = await EthUpdater.getLatestMirroredBlock();
    const latestNetBlock = await EthUpdater.getLatestNetworkBlock();
    const latestMirroredHash = await EthUpdater.getLatestMirroredBlockHash();
    const networkHash = (await EthereumProvider.getBlock(latestMirrored))?.hash;

    const empty = (await CnsRegistryEvent.count()) == 0;
    const blockHeightMatches = latestNetBlock >= latestMirrored;
    const blockHashMatches = latestMirroredHash === networkHash;
    if (empty || (blockHeightMatches && blockHashMatches)) {
      return { fromBlock: latestMirrored, toBlock: latestNetBlock };
    }

    if (!blockHeightMatches) {
      logger.warn(
        `Blockchain reorg detected: Sync last block ${latestMirrored} is less than the current mirror block ${latestNetBlock}`,
      );
    } else {
      logger.warn(
        `Blockchain reorg detected: last mirrored block hash ${latestMirroredHash} does not match the network block hash ${networkHash}`,
      );
    }

    const reorgStartingBlock = await this.handleReorg();
    logger.warn(
      `Handled blockchain reorg starting from block ${reorgStartingBlock}`,
    );

    return { fromBlock: reorgStartingBlock, toBlock: latestNetBlock };
  }

  public async run(): Promise<void> {
    logger.info('EthUpdater is pulling updates from Ethereum');

    const { fromBlock, toBlock } = await this.syncBlockRanges();

    logger.info(
      `[Current network block ${toBlock}]: Syncing mirror from ${fromBlock} to ${toBlock}`,
    );

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
        this.currentSyncBlockHash = (
          await EthereumProvider.getBlock(this.currentSyncBlock)
        ).hash;
        await this.saveLastMirroredBlock(manager);
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
