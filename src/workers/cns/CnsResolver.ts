import { env } from '../../env';
import * as _ from 'lodash';
import { Contract, Event, BigNumber, EventFilter, ethers } from 'ethers';
import { Domain } from '../../models';
import { Repository } from 'typeorm';
import { CNS } from '../../contracts';
import supportedKeysJson from 'dot-crypto/src/supported-keys/supported-keys.json';
import { InvalidValuesError, ExecutionRevertedError } from './BlockchainErrors';
import { CnsResolverError } from '../../errors/CnsResolverError';

const RecordsPerPage = env.APPLICATION.ETHEREUM.CNS_RESOLVER_RECORDS_PER_PAGE;

export class CnsResolver {
  private registry: Contract = CNS.Registry.getContract();
  private resolver: Contract = CNS.Resolver.getContract();
  private static DefaultKeysHashes = _.keys(supportedKeysJson.keys).reduce(
    (a, v) => {
      a[BigNumber.from(ethers.utils.id(v)).toString()] = v;
      return a;
    },
    {} as Record<string, string>,
  );

  private isNotLegacyResolver(resolver: string) {
    return !CNS.Resolver.legacyAddresses.find(
      (x) => x.toLowerCase() === resolver.toLowerCase(),
    );
  }

  async getResolverAddress(node: string): Promise<string | null> {
    try {
      const resolverAddress = await this.registry.callStatic.resolverOf(node);
      return Domain.normalizeResolver(resolverAddress);
    } catch (error) {
      if (
        !error.message.includes(InvalidValuesError) ||
        !error.message.includes(ExecutionRevertedError)
      ) {
        throw error;
      }
    }
    return null;
  }

  private async getResolverEvents(
    resolver: Contract,
    filter: EventFilter,
    fromBlock: number | string,
  ): Promise<Event[]> {
    return resolver.queryFilter(filter, fromBlock, 'latest');
  }

  private async getDomainResolution(
    domain: Domain,
  ): Promise<Record<string, string>> {
    if (!domain.resolver) {
      return {};
    }
    try {
      return await this.getAllDomainRecords(
        domain.resolver,
        BigNumber.from(domain.node),
      );
    } catch (error) {
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
      const domainNewKeyEvents = await this.getResolverEvents(
        resolver,
        filter,
        startingBlock,
      );
      if (domainNewKeyEvents.length > 0) {
        const domainKeys = domainNewKeyEvents.map((event: Event) => {
          return event.args!.key;
        });
        return _.uniq(domainKeys);
      }
    }

    return _.keys(supportedKeysJson.keys);
  }

  private async findNewKeysStartingBlock(
    resolverAddress: string,
    node: BigNumber,
  ): Promise<number> {
    if (this.isNotLegacyResolver(resolverAddress)) {
      const resolver: Contract = this.resolver.attach(resolverAddress);
      const filter: EventFilter = resolver.filters.ResetRecords(node);
      const resetRecordsEvents = await this.getResolverEvents(
        resolver,
        filter,
        env.APPLICATION.ETHEREUM.CNS_RESOLVER_ADVANCED_EVENTS_STARTING_BLOCK,
      );

      const lastResetEvent = _.last(resetRecordsEvents)!;
      if (lastResetEvent) {
        return lastResetEvent.blockNumber!;
      }
    }

    return env.APPLICATION.ETHEREUM.CNS_RESOLVER_ADVANCED_EVENTS_STARTING_BLOCK;
  }

  async getManyResolverRecords(
    resolverAddress: string,
    recordKeys: string[],
    node: BigNumber,
    recordsPerPage: number = RecordsPerPage,
  ): Promise<Record<string, string>> {
    const paginatedKeys = _.chunk(recordKeys, recordsPerPage);
    const paginatedRecordValues = await Promise.all(
      paginatedKeys.map(async (keys) => {
        return this.resolver
          .attach(resolverAddress)
          .callStatic.getMany(keys, node);
      }),
    );
    const recordValues = _.flatten(paginatedRecordValues);
    const records = _.zipObject(recordKeys, recordValues);

    return _.pickBy(records, (recordValue) => {
      return _.isString(recordValue) && !_.isEmpty(recordValue);
    });
  }

  async getAllDomainRecords(
    resolverAddress: string,
    node: BigNumber,
    recordsPerPage?: number,
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

    return this.getManyResolverRecords(
      resolverAddress,
      domainKeys,
      node,
      recordsPerPage,
    );
  }

  async getResolverRecordsByKeyHash(
    resolverAddress: string,
    keyHash: string,
    node: string,
  ): Promise<{ key: string; value: string }> {
    let key = _.get(CnsResolver.DefaultKeysHashes, keyHash);
    if (!key && this.isNotLegacyResolver(resolverAddress)) {
      key = await this.resolver
        .attach(resolverAddress)
        .callStatic.hashToKey(keyHash);
    }
    if (!key) {
      throw new CnsResolverError(`Can find resolver key for hash: ${keyHash}`);
    }
    const value = await this.resolver
      .attach(resolverAddress)
      .callStatic.get(key, node);
    return { key, value };
  }

  async fetchResolver(
    domain: Domain,
    domainRepository: Repository<Domain>,
  ): Promise<void> {
    const resolverAddress = await this.getResolverAddress(domain.node);
    if (domain.resolver === resolverAddress) {
      return;
    }
    domain.resolver = resolverAddress;
    domain.resolution = await this.getDomainResolution(domain);

    await domainRepository.save(domain);
  }
}
