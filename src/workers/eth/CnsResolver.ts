import { env } from '../../env';
import { Contract, Event, BigNumber, EventFilter, ethers } from 'ethers';
import { Domain } from '../../models';
import { Repository } from 'typeorm';
import { CryptoConfig } from '../../contracts';
import supportedKeysJson from 'dot-crypto/src/supported-keys/supported-keys.json';
import {
  InvalidValuesError,
  ExecutionRevertedError,
  Revert,
} from './BlockchainErrors';
import { CnsResolverError } from '../../errors/CnsResolverError';
import DomainsResolution from '../../models/DomainsResolution';

const RecordsPerPage = env.APPLICATION.ETHEREUM.RECORDS_PER_PAGE;

export class CnsResolver {
  private config: CryptoConfig;
  private registry: Contract;
  private resolver: Contract;
  private static DefaultKeysHashes = Object.keys(supportedKeysJson.keys).reduce(
    (a, v) => {
      a[BigNumber.from(ethers.utils.id(v)).toString()] = v;
      return a;
    },
    {} as Record<string, string>,
  );

  constructor(config: CryptoConfig) {
    this.config = config;
    this.registry = config.CNSRegistry.getContract();
    this.resolver = config.Resolver.getContract();
  }

  private isNotLegacyResolver(resolver: string) {
    return !this.config.Resolver.legacyAddresses.find(
      (x) => x.toLowerCase() === resolver.toLowerCase(),
    );
  }

  async _getResolverEvents(
    resolver: Contract,
    filter: EventFilter,
    fromBlock: number | string,
  ): Promise<Event[]> {
    return resolver.queryFilter(filter, fromBlock, 'latest');
  }

  private async getDomainResolution(
    domain: Domain,
    resolution: DomainsResolution,
  ): Promise<Record<string, string>> {
    if (!resolution.resolver) {
      return {};
    }
    try {
      return await this._getAllDomainRecords(
        resolution.resolver,
        BigNumber.from(domain.node),
      );
    } catch (error: any) {
      if (!error.message.includes(InvalidValuesError)) {
        throw error;
      }
    }

    return {};
  }

  private async findDomainKeys(
    resolverAddress: string,
    node: BigNumber,
    startingBlock: number,
  ): Promise<string[]> {
    if (this.isNotLegacyResolver(resolverAddress)) {
      const resolver: Contract = this.resolver.attach(resolverAddress);
      const filter: EventFilter = resolver.filters.NewKey(node);
      const domainNewKeyEvents = await this._getResolverEvents(
        resolver,
        filter,
        startingBlock,
      );

      if (domainNewKeyEvents.length > 0) {
        const domainKeys = domainNewKeyEvents.map((event: Event) => {
          return event.args?.key;
        });

        return [...new Set(domainKeys)];
      }
    }

    return Object.keys(supportedKeysJson.keys);
  }

  private async findNewKeysStartingBlock(
    resolverAddress: string,
    node: BigNumber,
  ): Promise<number> {
    if (this.isNotLegacyResolver(resolverAddress)) {
      const resolver: Contract = this.resolver.attach(resolverAddress);
      const filter: EventFilter = resolver.filters.ResetRecords(node);
      const resetRecordsEvents = await this._getResolverEvents(
        resolver,
        filter,
        env.APPLICATION.ETHEREUM.CNS_RESOLVER_ADVANCED_EVENTS_STARTING_BLOCK,
      );

      const lastResetEvent = resetRecordsEvents[resetRecordsEvents.length - 1];
      if (lastResetEvent && lastResetEvent.blockNumber) {
        return lastResetEvent.blockNumber;
      }
    }

    return env.APPLICATION.ETHEREUM.CNS_RESOLVER_ADVANCED_EVENTS_STARTING_BLOCK;
  }

  async _getManyDomainRecords(
    resolverAddress: string,
    recordKeys: string[],
    node: BigNumber,
  ): Promise<string[]> {
    return await this.resolver
      .attach(resolverAddress)
      .callStatic.getMany(recordKeys, node);
  }

  async _getAllDomainRecords(
    resolverAddress: string,
    node: BigNumber,
    recordsPerPage: number = RecordsPerPage,
  ): Promise<Record<string, string>> {
    const newKeysFromBlock = await this.findNewKeysStartingBlock(
      resolverAddress,
      node,
    );

    const domainKeys = await this.findDomainKeys(
      resolverAddress,
      node,
      newKeysFromBlock,
    );

    const recordsPromises: Promise<string[]>[] = [];
    let i = 0;
    //create paginated promises to fetch data
    while (i < domainKeys.length) {
      recordsPromises.push(
        this._getManyDomainRecords(
          resolverAddress,
          domainKeys.slice(i, i + recordsPerPage),
          node,
        ),
      );
      i += recordsPerPage;
    }
    const domainValues = (await Promise.all(recordsPromises)).flat();
    //zip domain keys and values
    const records = domainKeys.reduce((obj, key, i) => {
      if (domainValues[i] && typeof domainValues[i] === 'string') {
        return { ...obj, [key]: domainValues[i] };
      } else {
        return obj;
      }
    }, {} as Record<string, string>);

    return records;
  }

  async getResolverAddress(node: string): Promise<string | null> {
    try {
      const resolverAddress = await this.registry.callStatic.resolverOf(node);
      return Domain.normalizeResolver(resolverAddress);
    } catch (error: any) {
      if (
        !error.message.includes(InvalidValuesError) &&
        !error.message.includes(ExecutionRevertedError) &&
        !error.message.includes(Revert)
      ) {
        throw error;
      }
    }
    return null;
  }

  async getResolverRecordsByKeyHash(
    resolverAddress: string,
    keyHash: string,
    node: string,
  ): Promise<{ key: string; value: string }> {
    let key = CnsResolver.DefaultKeysHashes[keyHash];
    if (!key && this.isNotLegacyResolver(resolverAddress)) {
      key = await this.resolver
        .attach(resolverAddress)
        .callStatic.hashToKey(keyHash);
    }
    if (!key) {
      throw new CnsResolverError(
        `Can't find resolver key for hash: ${keyHash}`,
      );
    }
    const value = await this.resolver
      .attach(resolverAddress)
      .callStatic.get(key, node);
    return { key, value };
  }

  async fetchResolver(
    domain: Domain,
    resolution: DomainsResolution,
    domainRepository: Repository<Domain>,
  ): Promise<void> {
    const resolverAddress = await this.getResolverAddress(domain.node);
    if (resolution.resolver === resolverAddress) {
      return;
    }
    resolution.resolver = resolverAddress;
    resolution.resolution = await this.getDomainResolution(domain, resolution);
    domain.setResolution(resolution);
    await domainRepository.save(domain);
  }
}
