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

/**
 ** ZnsWorker initialize the configurations from env variables, and ZnsProvider
 *? ZnsWorker -> Talks ZnsProvider -> Provider talks with viewblock and with zilliqa api
 ** ZnsWorker#run() -> start the process 
 ** ZnsWorker asks ZnsProvider to fetch the latests transactions.
 ** ZnsProvider talks with database to get the last auixd then talks with viewBlock to fetch the transactions
 *! ZnsWorker begins to process the transactions
 ** ZnsWorker asks ZnsProvider to fetch the domain records from zilliqa
 ** ZnsProvider talks with Zilliqa api to fetch the records for domain
 ** ZnsWorker updates Domain and ZilTransactions tables accordingly for each transaction.
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

  async run() {
    const transactions = await this.provider.getLatestTransactions(
      this.perPage,
    );


  }
}
