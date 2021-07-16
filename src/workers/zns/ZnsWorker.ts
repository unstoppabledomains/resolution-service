import ZnsProvider, { ZnsTx } from './ZnsProvider';
import { EntityManager, getConnection, Repository, QueryRunner } from 'typeorm';
import { Domain, WorkerStatus } from '../../models';
import ZnsTransaction, {
  NewDomainEvent,
  ConfiguredEvent,
} from '../../models/ZnsTransaction';
import { znsChildhash } from '../../utils/namehash';
import { logger } from '../../logger';
import { isBech32 } from '@zilliqa-js/util/dist/validation';
import { fromBech32Address } from '@zilliqa-js/crypto';
import Bugsnag from '@bugsnag/js';

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

  private async getLastAtxuid() {
    const lastAtxuid = await WorkerStatus.latestAtxuidForWorker('ZNS');
    return lastAtxuid === undefined ? -1 : lastAtxuid;
  }

  private async saveWorkerStatus(
    latestBlock: number,
    latestAtxuid: number,
    manager: EntityManager,
  ): Promise<void> {
    const repository = manager.getRepository(WorkerStatus);
    return WorkerStatus.saveWorkerStatus(
      'ZNS',
      latestBlock,
      latestAtxuid,
      repository,
    );
  }

  async run(): Promise<void> {
    const lastAtxuid = await this.getLastAtxuid();
    let atxuidFrom = lastAtxuid + 1;
    const queryRunner = getConnection().createQueryRunner();
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const atxuidTo = atxuidFrom + this.perPage - 1;
      const transactions = await this.provider.getLatestTransactions(
        atxuidFrom,
        atxuidTo,
      );

      for (const transaction of transactions) {
        try {
          await this.processTransaction(transaction, queryRunner);
        } catch (error) {
          Bugsnag.notify(error);
          logger.error(
            `Failed to process Transaction ${JSON.stringify(transaction)}`,
          );
          await queryRunner.rollbackTransaction();
        }
      }

      if (transactions.length < this.perPage) {
        break;
      }

      atxuidFrom = transactions[transactions.length - 1].atxuid + 1;
    }
    await queryRunner.release();
  }

  private async processTransaction(
    transaction: ZnsTx,
    queryRunner: QueryRunner,
  ) {
    await queryRunner.startTransaction();
    const domainRepository = queryRunner.manager.getRepository(Domain);
    const znsTx = new ZnsTransaction({
      hash: transaction.hash,
      blockNumber: transaction.blockNumber,
      atxuid: transaction.atxuid,
      events: transaction.events,
    });
    const events = transaction.events;
    events.reverse();
    for (const event of events) {
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
        Bugsnag.notify(error);
        logger.error(`Failed to process event. ${JSON.stringify(event)}`);
        logger.error(error);
      }
    }

    await queryRunner.manager.getRepository(ZnsTransaction).save(znsTx);
    await this.saveWorkerStatus(
      transaction.blockNumber,
      transaction.atxuid,
      queryRunner.manager,
    );
    await queryRunner.commitTransaction();
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
