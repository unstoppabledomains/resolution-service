import { logger } from '../../logger';
import { setIntervalAsync } from 'set-interval-async/dynamic';
import { CnsProvider } from './CnsProvider';
import { CnsRegistryEvent, Domain, WorkerStatus } from '../../models';
import { env } from '../../env';
import { Contract, Event, BigNumber } from 'ethers';
import { EntityManager, getConnection, Repository } from 'typeorm';
import { CNS } from '../../contracts';
import { eip137Namehash } from '../../utils/namehash';
import { ExecutionRevertedError } from './BlockchainErrors';
import { CnsResolverError } from '../../errors/CnsResolverError';
import { CnsUpdaterError } from '../../errors/CnsUpdaterError';
import { CnsResolver } from './CnsResolver';

export class CnsUpdater {
  private registry: Contract = CNS.Registry.getContract();
  public resolver: CnsResolver = new CnsResolver();
  private currentSyncBlock = 0;
  private lastProcessedEvent?: Event;

  static getLatestNetworkBlock(): Promise<number> {
    return CnsProvider.getBlockNumber();
  }

  static getLatestMirroredBlock(): Promise<number> {
    return WorkerStatus.latestMirroredBlockForWorker('CNS');
  }

  private saveLastMirroredBlock(
    blockNumber: number,
    manager: EntityManager,
  ): Promise<void> {
    return WorkerStatus.saveWorkerStatus(
      'CNS',
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
    const node = CnsRegistryEvent.tokenIdToNode(event.args?.tokenId);
    const domain = await Domain.findByNode(node, domainRepository);
    //Check if it's not a new URI
    if (event.args?.from !== Domain.NullAddress) {
      if (!domain) {
        throw new CnsUpdaterError(
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
        const owner = event.args?.to.toLowerCase();
        domain.ownerAddress = owner;
        await this.resolver.fetchResolver(domain, domainRepository);
        await domainRepository.save(domain);
      }
    }
  }

  private async processNewUri(
    event: Event,
    domainRepository: Repository<Domain>,
  ): Promise<void> {
    if (!event.args) {
      throw new CnsUpdaterError(
        `NewUri event wasn't processed. Invalid event args.`,
      );
    }

    const { uri, tokenId } = event.args;
    const expectedNode = eip137Namehash(uri);
    const producedNode = CnsRegistryEvent.tokenIdToNode(tokenId);

    //Check if the domain name matches tokenID
    if (expectedNode !== producedNode) {
      throw new CnsUpdaterError(
        `NewUri event wasn't processed. Invalid domain name: ${uri}`,
      );
    }

    //Check if the previous event is "mint" - transfer from 0x0
    if (
      !this.lastProcessedEvent ||
      this.lastProcessedEvent.event !== 'Transfer' ||
      this.lastProcessedEvent.args?.from !== Domain.NullAddress
    ) {
      throw new CnsUpdaterError(
        `NewUri event wasn't processed. Unexpected order of events. Expected last processed event to be 'Transfer', got :'${this.lastProcessedEvent?.event}'`,
      );
    }

    const domain = new Domain();
    domain.attributes({
      name: uri,
      node: eip137Namehash(uri),
      location: 'CNS',
      ownerAddress: this.lastProcessedEvent.args?.to.toLowerCase(),
    });
    await domainRepository.save(domain);
  }

  private async processResolve(
    event: Event,
    domainRepository: Repository<Domain>,
  ): Promise<void> {
    const node = CnsRegistryEvent.tokenIdToNode(event.args?.tokenId);
    const domain = await Domain.findByNode(node, domainRepository);
    if (!domain) {
      throw new CnsUpdaterError(
        `Resolve event was not processed. Could not find domain for ${node}`,
      );
    }

    await this.resolver.fetchResolver(domain, domainRepository);
  }

  private async processSync(
    event: Event,
    domainRepository: Repository<Domain>,
  ): Promise<void> {
    const node = CnsRegistryEvent.tokenIdToNode(event.args?.tokenId);
    const domain = await Domain.findByNode(node, domainRepository);
    if (!domain) {
      throw new CnsUpdaterError(
        `Sync event was not processed. Could not find domain for node: ${node}`,
      );
    }
    if (event.args?.updateId === undefined) {
      throw new CnsUpdaterError(
        `Sync event was not processed. Update id not specified.`,
      );
    }

    const keyHash = event.args?.updateId.toString();
    const resolverAddress = await this.resolver.getResolverAddress(node);
    if (keyHash === '0' || !resolverAddress) {
      domain.resolution = {};
      await domainRepository.save(domain);
      return;
    }

    try {
      const resolutionRecord = await this.resolver.getResolverRecordsByKeyHash(
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

    await manager.getRepository(CnsRegistryEvent).save(
      new CnsRegistryEvent({
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
        if (error instanceof CnsUpdaterError) {
          logger.error(
            `Failed to process CNS event: ${JSON.stringify(
              event,
            )}. Error:  ${error}`,
          );
        }
      }
    }
  }

  public async run(): Promise<void> {
    logger.info('CnsUpdater is pulling updates from Ethereum');
    const fromBlock = await CnsUpdater.getLatestMirroredBlock();
    const toBlock =
      (await CnsUpdater.getLatestNetworkBlock()) -
      env.APPLICATION.ETHEREUM.CNS_CONFIRMATION_BLOCKS;

    logger.info(
      `[Current network block ${toBlock}]: Syncing mirror from ${fromBlock} to ${toBlock}`,
    );

    if (toBlock < fromBlock) {
      throw new CnsUpdaterError(
        `Sync last block ${toBlock} is less than the current mirror block ${fromBlock}`,
      );
    }

    this.currentSyncBlock = fromBlock;

    while (this.currentSyncBlock < toBlock) {
      const fetchBlock = Math.min(
        this.currentSyncBlock + env.APPLICATION.ETHEREUM.CNS_BLOCK_FETCH_LIMIT,
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
      logger.info('CnsUpdater is pulling updates from Ethereum');
      await new CnsUpdater().run();
    } catch (error) {
      logger.error(
        `Unhandled error occured while processing CNS events: ${error}`,
      );
    }
  }, env.APPLICATION.ETHEREUM.CNS_FETCH_INTERVAL);
}
