import { expect } from 'chai';
import ZnsProvider from './ZnsProvider';
import ZnsWorker from './ZnsWorker';

let worker: ZnsWorker;
let provider: ZnsProvider;

describe("ZnsWorker", () => {
  beforeEach(() => {
    worker = new ZnsWorker();
  });
  
  it('should init', () => {
    expect(worker).exist;
  });

  it.only('should fetch transaction and update the database', async () => {
    worker = new ZnsWorker({perPage: 5});
    await worker.run();
  })
});

describe('ZnsProvider', () => {
  beforeEach(() => {
    provider = new ZnsProvider();
  });

  it('should init', async () => {
    expect(provider).exist;
  });


  it('should return the transaction', async () => {
    const transactions = await provider.getLatestTransactions(1);
    expect(transactions.length).eq(1);
  });

  it('should return the 5 transactions', async () => {
    const transactions = await provider.getLatestTransactions(5);
    expect(transactions.length).eq(5);
  });

})