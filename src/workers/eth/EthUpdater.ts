import { WorkerLogger } from '../../logger';
import { setIntervalAsync } from 'set-interval-async/dynamic';
import { CnsRegistryEvent, Domain, WorkerStatus } from '../../models';
import { Contract, Event, BigNumber } from 'ethers';
import { EntityManager, getConnection, Repository } from 'typeorm';
import { CryptoConfig, getEthConfig } from '../../contracts';
import { eip137Namehash } from '../../utils/namehash';
import { EthUpdaterError } from '../../errors/EthUpdaterError';
import {
  GetProviderForConfig,
  StaticJsonRpcProvider,
} from '../../workers/EthereumProvider';
import { unwrap } from '../../utils/option';
import { CnsResolverError } from '../../errors/CnsResolverError';
import { ExecutionRevertedError } from './BlockchainErrors';
import { CnsResolver } from './CnsResolver';
import * as ethersUtils from '../../utils/ethersUtils';
import { Blockchain } from '../../types/common';
import { EthUpdaterConfig } from '../../env';
import winston from 'winston';

export class EthUpdater {
  private unsRegistry: Contract;
  private cnsRegistry: Contract;
  private cnsResolver: CnsResolver;
  readonly blockchain: Blockchain;
  readonly networkId: number;
  private provider: StaticJsonRpcProvider;

  private config: EthUpdaterConfig;
  private cryptoConfig: CryptoConfig;

  private currentSyncBlock = 0;
  private currentSyncBlockHash = '';

  private logger: winston.Logger;

  constructor(blockchain: Blockchain, config: EthUpdaterConfig) {
    this.logger = WorkerLogger(blockchain);
    this.config = config;
    this.networkId = config.NETWORK_ID;
    this.blockchain = blockchain;
    this.provider = GetProviderForConfig(config);
    this.cryptoConfig = getEthConfig(this.networkId.toString(), this.provider);

    this.unsRegistry = this.cryptoConfig.UNSRegistry.getContract();
    this.cnsRegistry = this.cryptoConfig.CNSRegistry.getContract();
    this.cnsResolver = new CnsResolver(this.cryptoConfig);
  }

  async getLatestNetworkBlock(): Promise<number> {
    return (
      (await ethersUtils.getLatestNetworkBlock(this.provider)) -
      this.config.CONFIRMATION_BLOCKS
    );
  }

  getLatestMirroredBlock(): Promise<number> {
    return WorkerStatus.latestMirroredBlockForWorker(this.blockchain);
  }

  getLatestMirroredBlockHash(): Promise<string | undefined> {
    return WorkerStatus.latestMirroredBlockHashForWorker(this.blockchain);
  }

  private async saveLastMirroredBlock(manager: EntityManager): Promise<void> {
    return WorkerStatus.saveWorkerStatus(
      this.blockchain,
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
    let unsEvents: Event[] = [];
    if (this.unsRegistry.address != Domain.NullAddress) {
      unsEvents = await this.unsRegistry.queryFilter({}, fromBlock, toBlock);
      this.logger.info(
        `Fetched ${
          unsEvents.length
        } unsEvents from ${fromBlock} to ${toBlock} by ${
          toBlock - fromBlock + 1
        } `,
      );
    }

    let cnsEvents: Event[] = [];
    if (this.cnsRegistry.address != Domain.NullAddress) {
      cnsEvents = await this.cnsRegistry.queryFilter({}, fromBlock, toBlock);

      this.logger.info(
        `Fetched ${
          cnsEvents.length
        } cnsEvents from ${fromBlock} to ${toBlock} by ${
          toBlock - fromBlock + 1
        } `,
      );
    }

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
        resolution.ownerAddress = Domain.NullAddress;
        resolution.resolution = {};
        resolution.resolver = null;
        resolution.registry = null;
        domain.setResolution(resolution);
        await domainRepository.save(domain);
      } else {
        resolution.ownerAddress = event.args?.to.toLowerCase();
        await domainRepository.save(domain);
      }
    } else if (domain) {
      // domain exists, so it's probably a bridge
      const resolution = domain.getResolution(this.blockchain, this.networkId);

      resolution.ownerAddress = event.args?.to.toLowerCase();
      resolution.registry = this.cnsRegistry.address;

      const contractAddress = event.address.toLowerCase();
      if (contractAddress === this.unsRegistry.address.toLowerCase()) {
        resolution.resolver = contractAddress;
        resolution.registry = this.unsRegistry.address.toLowerCase();
      }
      domain.setResolution(resolution); // create resolution for L2
      await domainRepository.save(domain);
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

    const domain = await Domain.findOrBuildByNode(
      producedNode,
      domainRepository,
    );
    const resolution = domain.getResolution(this.blockchain, this.networkId);

    domain.name = uri;
    resolution.ownerAddress = lastProcessedEvent.args?.to.toLowerCase();
    resolution.registry = this.cnsRegistry.address;

    const contractAddress = event.address.toLowerCase();
    if (contractAddress === this.unsRegistry.address.toLowerCase()) {
      resolution.resolver = contractAddress;
      resolution.registry = this.unsRegistry.address.toLowerCase();
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
      const resolutionRecord =
        await this.cnsResolver.getResolverRecordsByKeyHash(
          resolverAddress,
          keyHash,
          node,
        );
      resolution.resolution[resolutionRecord.key] = resolutionRecord.value;
    } catch (error: unknown) {
      if (error instanceof CnsResolverError) {
        this.logger.warn(error);
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
        blockchain: this.blockchain,
        networkId: this.networkId,
        node: event.args?.[0],
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
        this.logger.debug(
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
          this.logger.error(
            `Failed to process ${this.blockchain} event: ${JSON.stringify(
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
      this.config.MAX_REORG_SIZE,
      this.blockchain,
      this.networkId,
    );

    // Check first and last blocks as edge cases
    const [firstNetBlock, lastNetBlock] = await Promise.all([
      this.provider.getBlock(latestEventBlocks[0].blockNumber),
      this.provider.getBlock(
        latestEventBlocks[latestEventBlocks.length - 1].blockNumber,
      ),
    ]);

    // If the oldest event block doesn't match, the reorg must be too long.
    if (firstNetBlock.hash !== latestEventBlocks[0].blockHash) {
      throw new EthUpdaterError(
        `Detected reorg that is larger than ${this.config.MAX_REORG_SIZE} blocks. Manual resync is required.`,
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
      const netBlock = await this.provider.getBlock(ourBlock.blockNumber);
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

    this.logger.debug(`Rebuilding domain ${domain?.name} from db events`);
    const domainEvents = await CnsRegistryEvent.find({
      where: {
        node: tokenId,
        blockchain: this.blockchain,
        networkId: this.networkId,
      },
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

    await domain?.getResolution(this.blockchain, this.networkId)?.remove();
    await this.processEvents(convertedEvents, manager, false);
  }

  private async handleReorg(): Promise<number> {
    const reorgStartingBlock = await this.findLastMatchingBlock();

    await getConnection().transaction(async (manager) => {
      await WorkerStatus.saveWorkerStatus(
        this.blockchain,
        reorgStartingBlock.blockNumber,
        reorgStartingBlock.blockHash,
        undefined,
        manager.getRepository(WorkerStatus),
      );

      const cleanUp = await CnsRegistryEvent.cleanUpEvents(
        reorgStartingBlock.blockNumber,
        this.blockchain,
        this.networkId,
        manager.getRepository(CnsRegistryEvent),
      );

      const promises: Promise<void>[] = [];
      for (const tokenId of cleanUp.affected) {
        promises.push(this.rebuildDomainFromEvents(tokenId, manager));
      }
      await Promise.all(promises);

      this.logger.warn(
        `Deleted ${cleanUp.deleted} events after reorg and reverted ${cleanUp.affected.size} domains`,
      );
    });

    return reorgStartingBlock.blockNumber;
  }

  private async syncBlockRanges(): Promise<{
    fromBlock: number;
    toBlock: number;
  }> {
    const latestMirrored = await this.getLatestMirroredBlock();
    const latestNetBlock = await this.getLatestNetworkBlock();
    if (latestMirrored === 0) {
      return {
        fromBlock: Math.min(
          this.config.UNS_REGISTRY_EVENTS_STARTING_BLOCK,
          this.config.CNS_REGISTRY_EVENTS_STARTING_BLOCK,
        ),
        toBlock: latestNetBlock,
      };
    }

    const latestMirroredHash = await this.getLatestMirroredBlockHash();
    const networkHash = (await this.provider.getBlock(latestMirrored))?.hash;

    const blockHeightMatches = latestNetBlock >= latestMirrored;
    const blockHashMatches = latestMirroredHash === networkHash;
    if (blockHeightMatches && blockHashMatches) {
      return { fromBlock: latestMirrored, toBlock: latestNetBlock };
    }

    if (!blockHeightMatches) {
      this.logger.warn(
        `Blockchain reorg detected: Sync last block ${latestMirrored} is less than the current mirror block ${latestNetBlock}`,
      );
    } else {
      this.logger.warn(
        `Blockchain reorg detected: last mirrored block hash ${latestMirroredHash} does not match the network block hash ${networkHash}`,
      );
    }

    const reorgStartingBlock = await this.handleReorg();
    this.logger.warn(
      `Handled blockchain reorg starting from block ${reorgStartingBlock}`,
    );

    return { fromBlock: reorgStartingBlock, toBlock: latestNetBlock };
  }

  public async run(): Promise<void> {
    try {
      this.logger.info(`EthUpdater is pulling updates from ${this.blockchain}`);

      const { fromBlock, toBlock } = await this.syncBlockRanges();

      this.logger.info(
        `Current network block ${toBlock}: Syncing mirror from ${fromBlock} to ${toBlock}`,
      );

      this.currentSyncBlock = fromBlock;

      while (this.currentSyncBlock < toBlock) {
        const fetchBlock = Math.min(
          this.currentSyncBlock + this.config.BLOCK_FETCH_LIMIT,
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
            await this.provider.getBlock(this.currentSyncBlock)
          )?.hash;
          await this.saveLastMirroredBlock(manager);
        });
      }
    } catch (error) {
      this.logger.error(
        `Unhandled error occured while processing ${this.blockchain} events: ${error}`,
      );
    }
  }
}

export function startWorker(blockchain: Blockchain, config: any): void {
  setIntervalAsync(async () => {
    await new EthUpdater(blockchain, config).run();
  }, config.FETCH_INTERVAL);
}
