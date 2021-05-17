import ZnsProvider from './ZnsProvider';
import { EntityManager, getConnection, IsNull, Repository } from 'typeorm';
import { Domain } from '../../models';
import ZnsTransaction, { NewDomainEvent, ConfiguredEvent } from '../../models/ZnsTransaction';
import { znsChildhash } from '../../utils/namehash';
import { logger } from '../../logger';
import { isBech32 } from '@zilliqa-js/util/dist/validation';
import { fromBech32Address } from '@zilliqa-js/crypto';

type ZnsWorkerOptions = {
  perPage?: number;
};

export default class ZnsWorker {
  private provider: ZnsProvider;
  private perPage: number;

  constructor(options?: ZnsWorkerOptions) {
    this.perPage = options?.perPage || 25;
    this.provider = new ZnsProvider();
  }

  async run(): Promise<void> {
    const stats = await this.provider.getChainStats();
    const lastAtxuid = await ZnsTransaction.latestAtxuid();
    let atxuidFrom = lastAtxuid + 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const atxuidTo = atxuidFrom + this.perPage - 1;
      const transactions = await this.provider.getLatestTransactions(
        atxuidFrom,
        atxuidTo,
      );

      await getConnection().transaction(async (manager) => {
        for (const transaction of transactions) {
          await this.processTransaction(transaction, manager);
        }
      });

      if (transactions.length === 0) {
        await this.createEmptyTransaction(stats.txHeight);
      }

      if (transactions.length < this.perPage) {
        break;
      }
      atxuidFrom = transactions[transactions.length - 1].atxuid! + 1;
    }
  }

  private async createEmptyTransaction(blockNumber: number) {
    const entry = await ZnsTransaction.findOne({
      where: { blockNumber, atxuid: IsNull(), hash: IsNull() },
    });
    if (entry) {
      return;
    }

    const attributes = {
      blockNumber,
      events: [],
    };
    await ZnsTransaction.persist(attributes);
  }

  private async processTransaction(
    transaction: ZnsTransaction,
    manager: EntityManager,
  ) {
    logger.info("LOOK");
    logger.info(JSON.stringify(transaction));
    const domainRepository = manager.getRepository(Domain);
    const znsTx = new ZnsTransaction({
      hash: transaction.hash,
      blockNumber: transaction.blockNumber,
      atxuid: transaction.atxuid,
      events: transaction.events,
    });
    const events = transaction.events;
    for (const event of events.reverse()) {
      try {
        switch (event.name) {
          case 'NewDomain': {
            await this.parseNewDomainEvent(
              event as NewDomainEvent,
              domainRepository,
            );
            break;
          }
          case 'Configured': {
            await this.parseConfiguredEvent(
              event as ConfiguredEvent,
              domainRepository,
            );
            break;
          }
        }
      } catch (error) {
        logger.error(`Failed to process event. ${JSON.stringify(event)}`);
        logger.error(error);
      }
    }
    await znsTx.save();
  }

  private async parseNewDomainEvent(
    event: NewDomainEvent,
    repository: Repository<Domain>,
  ): Promise<void> {
    const { label, parent } = event.params;
    if (this.isInvalidLabel(label)) {
      throw new Error(
        `Invalid domain label ${label} at NewDomain event for ${parent}`,
      );
    }
    const parentDomain = await Domain.findByNode(parent, repository);
    if (!parentDomain) {
      throw new Error(`Can not find parent node ${parent} for label ${label}`);
    }
    const node = znsChildhash(parentDomain.node, label);
    const domain = await Domain.findOrBuildByNode(node, repository);
    domain.attributes({
      name: `${label}.${parentDomain.name}`,
      location: 'ZNS',
    });
    await repository.save(domain);
  }

  private async parseConfiguredEvent(
    event: ConfiguredEvent,
    repository: Repository<Domain>,
  ): Promise<void> {
    const eventParams = event.params;
    const { node } = eventParams;
    const owner = isBech32(eventParams.owner)
      ? fromBech32Address(eventParams.owner).toLowerCase()
      : eventParams.owner;
    const resolver = isBech32(eventParams.resolver)
      ? fromBech32Address(eventParams.resolver).toLowerCase()
      : eventParams.resolver;

    const domain = await Domain.findByNode(node, repository);
    if (domain) {
      const resolution = await this.provider.requestZilliqaResolutionFor(
        resolver,
      );

      domain.attributes({
        resolver: resolver !== Domain.NullAddress ? resolver : undefined,
        ownerAddress: owner !== Domain.NullAddress ? owner : undefined,
        resolution: resolution ? resolution : {},
      });
      await repository.save(domain);
    }
  }

  private isInvalidLabel(label: string | undefined) {
    return !label || label.includes('.') || !!label.match(/[A-Z]/);
  }
}
