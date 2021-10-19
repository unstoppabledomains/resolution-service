import ZnsProvider, { ZnsTx } from './ZilProvider';
import { EntityManager, getConnection, QueryRunner } from 'typeorm';
import { Domain, WorkerStatus } from '../../models';
import ZnsTransaction, {
  NewDomainEvent,
  ConfiguredEvent,
} from '../../models/ZnsTransaction';
import { znsChildhash } from '../../utils/namehash';
import { logger } from '../../logger';
import { isBech32 } from '@zilliqa-js/util/dist/validation';
import { fromBech32Address } from '@zilliqa-js/crypto';
import { ZnsTransactionEvent } from '../../models/ZnsTransaction';
import { Blockchain } from '../../types/common';
import { env } from '../../env';

type ZilWorkerOptions = {
  perPage?: number;
};

export default class ZilWorker {
  private provider: ZnsProvider;
  private perPage: number;

  constructor(options?: ZilWorkerOptions) {
    this.perPage = options?.perPage || 25;
    this.provider = new ZnsProvider();
  }

  private async getLastAtxuid() {
    const lastAtxuid = await WorkerStatus.latestAtxuidForWorker('ZIL');
    return lastAtxuid === undefined ? -1 : lastAtxuid;
  }

  private async saveWorkerStatus(
    latestBlock: number,
    latestAtxuid: number,
    manager: EntityManager,
  ): Promise<void> {
    const repository = manager.getRepository(WorkerStatus);
    return WorkerStatus.saveWorkerStatus(
      'ZIL',
      latestBlock,
      undefined,
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
    const events = transaction.events;
    events.reverse();

    for (const event of events) {
      try {
        await this.processTransactionEvent(event, queryRunner);
      } catch (error) {
        logger.error(`Failed to process event. ${JSON.stringify(event)}`);
        logger.error(error);
      }
    }

    await this.saveZnsTransaction(transaction, queryRunner);
    await this.saveWorkerStatus(
      transaction.blockNumber,
      transaction.atxuid,
      queryRunner.manager,
    );
    await queryRunner.commitTransaction();
  }

  private async processTransactionEvent(
    event: ZnsTransactionEvent,
    queryRunner: QueryRunner,
  ): Promise<void> {
    switch (event.name) {
      case 'NewDomain': {
        await this.parseNewDomainEvent(event as NewDomainEvent, queryRunner);
        break;
      }
      case 'Configured': {
        await this.parseConfiguredEvent(event as ConfiguredEvent, queryRunner);
        break;
      }
    }
  }

  private async saveZnsTransaction(
    transaction: ZnsTx,
    queryRunner: QueryRunner,
  ): Promise<void> {
    const znsTx = new ZnsTransaction({
      hash: transaction.hash,
      blockNumber: transaction.blockNumber,
      atxuid: transaction.atxuid,
      events: transaction.events,
    });
    await queryRunner.manager.getRepository(ZnsTransaction).save(znsTx);
  }

  private async parseNewDomainEvent(
    event: NewDomainEvent,
    queryRunner: QueryRunner,
  ): Promise<void> {
    const { label, parent } = event.params;
    const repository = queryRunner.manager.getRepository(Domain);
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
      registry: this.provider.registryAddress,
      blockchain: Blockchain.ZIL,
      networkId: env.APPLICATION.ZILLIQA.NETWORK_ID,
    });
    await repository.save(domain);
  }

  private async parseConfiguredEvent(
    event: ConfiguredEvent,
    queryRunner: QueryRunner,
  ): Promise<void> {
    const eventParams = event.params;
    const repository = queryRunner.manager.getRepository(Domain);
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
        resolver: resolver !== Domain.NullAddress ? resolver : null,
        ownerAddress: owner !== Domain.NullAddress ? owner : null,
        resolution: resolution ? resolution : {},
        registry:
          owner !== Domain.NullAddress ? this.provider.registryAddress : null,
      });
      await repository.save(domain);
    }
  }

  private isInvalidLabel(label: string | undefined) {
    return !label || label.includes('.') || !!label.match(/[A-Z]/);
  }
}
