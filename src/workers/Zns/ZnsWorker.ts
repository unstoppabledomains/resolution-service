// ? This is the entry point class. When initialized it should configure itself from the env variables.
// * Then it should talk with database and get the last transaction atuix number
// * It then should perform a call to viewblock api to get the transactions from the last one + 1 to last one + perPage - 1
// * After it should process all transactions, meaning parse the data and save everything in the database
// ! In a single transactions there is a metadata about the block that is mined it's hash the height of the chain, data from and to and etc.
// ! Each transaction has events field => an array of events
// * There are 2 types of events: NewDomain and Configured
// ? when the event is configured
// * We want to make a call to Zilliqa API and fetch the updated records.
// **  After we want to update the database with new values
// ? when event is NewDomain
// * We want to create a new domain record in db.

import ZnsProvider from './ZnsProvider';
import { EntityManager, getConnection, Repository } from 'typeorm';
import { Domain } from '../../models';
import { NewDomainEvent, ConfiguredEvent } from '../../models/ZnsTransaction';
import ZnsTransaction from '../../models/ZnsTransaction';
import { znsChildhash } from '../../utils/namehash';
import { logger } from '../../logger';
import { fromBech32Address } from './Bech32Helper';
/**
 ** ZnsWorker initialize the configurations from env variables, and ZnsProvider
 *? ZnsWorker -> Talks ZnsProvider -> Provider talks with viewblock and with zilliqa api
 ** ZnsWorker#run() -> start the process
 ** ZnsWorker asks ZnsProvider to fetch the latests transactions.
 ** ZnsProvider talks with database to get the last auixd then talks with viewBlock to fetch the transactions
 ** ZnsWorker begins to process the transactions
 ** ZnsWorker asks ZnsProvider to fetch the domain records from zilliqa
 ** ZnsProvider talks with Zilliqa api to fetch the records for domain
 ** ZnsWorker updates Domain and ZilTransactions tables accordingly for each transaction.
 ** Cycle should keep repeating
 */

/**
 *? What databases structure should look like?
 ** We need information about transaction
 ** We need a seperate table for events? Do we? There can be not than many events in 1 transaction. So far I only saw two as the max
 ** Since i have a table of all transactions, I can just have an array of 2 records max per transaction. NewDomain and Configured event.
 *
 */

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
    const transactions = await this.provider.getLatestTransactions(
      this.perPage,
    );
    await getConnection().transaction(async (manager) => {
      for (const transaction of transactions) {
        await this.processTransaction(transaction, manager);
      }
    });
  }

  private async processTransaction(
    transaction: ZnsTransaction,
    manager: EntityManager,
  ) {
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
    const owner = eventParams.owner.startsWith('zil1')
      ? fromBech32Address(eventParams.owner).toLowerCase()
      : eventParams.owner;
    const resolver = eventParams.resolver.startsWith('zil1')
      ? fromBech32Address(eventParams.resolver).toLowerCase()
      : eventParams.resolver;

    const domain = await Domain.findByNode(node, repository);
    if (domain) {
      const resolution = await this.provider.requestZilliqaResolutionFor(
        resolver,
      );

      domain.attributes({
        resolver,
        ownerAddress: owner !== Domain.NullAddress ? owner : undefined,
        resolution,
      });
      await repository.save(domain);
    }
  }

  private isInvalidLabel(label: string | undefined) {
    return !label || label.includes('.') || !!label.match(/[A-Z]/);
  }
}
