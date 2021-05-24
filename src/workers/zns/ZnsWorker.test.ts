import { expect } from 'chai';
import { getManager } from 'typeorm';
import ZnsWorker from './ZnsWorker';
import ZnsTransaction from '../../models/ZnsTransaction';
import { Domain } from '../../models';
import nock from 'nock';
import ChainStatsMockResponse from '../../../mocks/chainStatsMockResponse.json';
import FirstTwoTransactions from '../../../mocks/firstTwoTransactions.json';
import CorrectTransactions from '../../../mocks/correctTransactions.json';
import NewDomainEventsWithWrongLabel from '../../../mocks/newDomainEventsWithWrongLabel.json';
import CorrectNewDomainEvents from '../../../mocks/correctNewDomainEvents.json';

import { env } from '../../env';
import { isBech32 } from '@zilliqa-js/util/dist/validation';
import { fromBech32Address } from '@zilliqa-js/crypto';
import { ZnsTx } from './ZnsProvider';

let worker: ZnsWorker;

describe('ZnsWorker', () => {
  beforeEach(() => {
    worker = new ZnsWorker();
  });

  it('should init', async () => {
    expect(worker).exist;
  });

  it('should run for the first 2 transactions', async () => {
    worker = new ZnsWorker({ perPage: 2 });
    const chainStatsInterceptor = nock('https://api.viewblock.io')
      .get('/v1/zilliqa/stats')
      .query(true)
      .reply(200, ChainStatsMockResponse);

    const transactionInterceptor = nock('https://api.viewblock.io')
      .get(
        `/v1/zilliqa/addresses/${env.APPLICATION.ZILLIQA.ZNS_REGISTRY_CONTRACT}/txs`,
      )
      .query(true)
      .reply(200, FirstTwoTransactions);

    // For some reason .query doesn't filter the request, had to specify it in the url instead
    const loopEndingTransactionInterceotor = nock('https://api.viewblock.io')
      .get(
        `/v1/zilliqa/addresses/${env.APPLICATION.ZILLIQA.ZNS_REGISTRY_CONTRACT}/txs?network=${env.APPLICATION.ZILLIQA.NETWORK}&events=true&atxuidFrom=2&atxuidTo=3`,
      )
      .reply(200, []);

    await worker.run();
    chainStatsInterceptor.done();
    transactionInterceptor.done();
    loopEndingTransactionInterceotor.done();
    for (const transaction of FirstTwoTransactions) {
      const txfromDb = await ZnsTransaction.findOne({
        hash: transaction.hash,
      });
      expect(txfromDb?.atxuid).to.eq(transaction.atxuid);
    }
    const loopEndingEmptyTransactionFromDb = await ZnsTransaction.findOne({
      blockNumber: ChainStatsMockResponse.txHeight,
    });
    expect(loopEndingEmptyTransactionFromDb).exist;
    expect(loopEndingEmptyTransactionFromDb?.atxuid).to.eq(null);
    expect(loopEndingEmptyTransactionFromDb?.blockNumber).to.eq(
      ChainStatsMockResponse.txHeight,
    );
  });

  it('should not create the same empty transaction twice', async () => {
    worker = new ZnsWorker({ perPage: 2 });
    const chainStatsInterceptor = nock('https://api.viewblock.io')
      .get('/v1/zilliqa/stats')
      .query(true)
      .times(2)
      .reply(200, ChainStatsMockResponse);

    const transactionInterceptor = nock('https://api.viewblock.io')
      .get(
        `/v1/zilliqa/addresses/${env.APPLICATION.ZILLIQA.ZNS_REGISTRY_CONTRACT}/txs`,
      )
      .query(true)
      .times(2)
      .reply(200, []);

    await worker.run();
    // running the worker again to get the point where we check for the same empty transaction
    await worker.run();
    chainStatsInterceptor.done();
    transactionInterceptor.done();

    const emptyTransactions = await ZnsTransaction.find({
      blockNumber: ChainStatsMockResponse.txHeight,
    });
    expect(emptyTransactions.length).to.equal(1);
  });

  it('should not store the domain if parent is missing in db', async () => {
    worker = new ZnsWorker({ perPage: 2 });
    const chainStatsInterceptor = nock('https://api.viewblock.io')
      .get('/v1/zilliqa/stats')
      .query(true)
      .reply(200, ChainStatsMockResponse);

    const fakeTransaction = {
      ...FirstTwoTransactions[0],
      events: [CorrectNewDomainEvents[0]],
    };
    fakeTransaction.events[0].params.parent =
      '0xdeaddeaddeaddeaddeaddeaddeaddeaddeaddead';

    const transactionInterceptor = nock('https://api.viewblock.io')
      .get(
        `/v1/zilliqa/addresses/${env.APPLICATION.ZILLIQA.ZNS_REGISTRY_CONTRACT}/txs`,
      )
      .query(true)
      .reply(200, [fakeTransaction]);

    await worker.run();
    chainStatsInterceptor.done();
    transactionInterceptor.done();

    // transaction should be stored
    const txFromDb = await ZnsTransaction.findOne({
      hash: fakeTransaction.hash,
    });
    expect(txFromDb).exist;
    expect(txFromDb?.atxuid).to.equal(fakeTransaction.atxuid);
    // domain should not be process or added to the db due to wrong label
    const domainFromDb = await Domain.findOne({
      name: fakeTransaction.events[0].params.label + '.zil',
    });
    expect(domainFromDb).to.not.exist;
  });

  describe('.ConfiguredEvent', () => {
    it('should process the configured event from transaction', async () => {
      worker = new ZnsWorker({ perPage: 2 });
      const chainStatsInterceptor = nock('https://api.viewblock.io')
        .get('/v1/zilliqa/stats')
        .query(true)
        .reply(200, ChainStatsMockResponse);

      const fakeTransaction = {
        ...CorrectTransactions[2],
      };

      const transactionInterceptor = nock('https://api.viewblock.io')
        .get(
          `/v1/zilliqa/addresses/${env.APPLICATION.ZILLIQA.ZNS_REGISTRY_CONTRACT}/txs`,
        )
        .query(true)
        .reply(200, [fakeTransaction]);

      const zilliqaInterceptor = nock('https://dev-api.zilliqa.com/')
        .post('/')
        .reply(200, {
          error: {
            code: -5,
            data: null,
            message: 'Address not contract address',
          },
          id: 1,
          jsonrpc: '2.0',
        });

      await worker.run();
      chainStatsInterceptor.done();
      transactionInterceptor.done();
      zilliqaInterceptor.done();

      // transaction should be stored
      const txFromDb = await ZnsTransaction.findOne({
        hash: fakeTransaction.hash,
      });
      expect(txFromDb).exist;
      expect(txFromDb?.atxuid).to.equal(fakeTransaction.atxuid);
      // domain should be stored with ether addresses
      const domainFromDb = await Domain.findOne({
        name: fakeTransaction.events[1].params.label + '.zil',
      });
      expect(domainFromDb).to.exist;
      expect(isBech32(domainFromDb!.ownerAddress!)).to.be.false;
      expect(domainFromDb!.ownerAddress!).to.equal(
        fromBech32Address(
          fakeTransaction.events[0].params.owner!,
        ).toLowerCase(),
      );
      expect(domainFromDb?.resolver).to.be.null;
    });

    it('should not update the db due to missing node in db', async () => {
      worker = new ZnsWorker({ perPage: 2 });
      const chainStatsInterceptor = nock('https://api.viewblock.io')
        .get('/v1/zilliqa/stats')
        .query(true)
        .reply(200, ChainStatsMockResponse);

      const fakeTransaction = {
        ...CorrectTransactions[2],
      };
      fakeTransaction.events[0] = {
        ...fakeTransaction.events[0],
        params: {
          ...fakeTransaction.events[0].params,
          node: 'someWrongNodeInEventThatIsDefinitelyMissing',
        },
      } as any;

      const transactionInterceptor = nock('https://api.viewblock.io')
        .get(
          `/v1/zilliqa/addresses/${env.APPLICATION.ZILLIQA.ZNS_REGISTRY_CONTRACT}/txs`,
        )
        .query(true)
        .reply(200, [fakeTransaction]);

      const zilliqaInterceptor = nock('https://dev-api.zilliqa.com/')
        .post('/')
        .reply(200, {
          error: {
            code: -5,
            data: null,
            message: 'Address not contract address',
          },
          id: 1,
          jsonrpc: '2.0',
        });
      await worker.run();
      chainStatsInterceptor.done();
      transactionInterceptor.done();
      // this call should not be fired since node is not found in db
      expect(zilliqaInterceptor.isDone()).to.be.false;
      // transaction should be stored
      const txFromDb = await ZnsTransaction.findOne({
        hash: fakeTransaction.hash,
      });
      expect(txFromDb).exist;
      expect(txFromDb?.atxuid).to.equal(fakeTransaction.atxuid);
      // domain should be stored with ether addresses
      const domainFromDb = await Domain.findOne({
        name: fakeTransaction.events[1].params.label + '.zil',
      });
      expect(domainFromDb).to.exist;
      expect(domainFromDb?.ownerAddress).to.be.null;
      expect(domainFromDb?.resolver).to.be.null;
    });
  });

  describe('.failedNewDomainEvent', () => {
    it('label in newDomain event should not include dots', async () => {
      worker = new ZnsWorker({ perPage: 2 });
      const chainStatsInterceptor = nock('https://api.viewblock.io')
        .get('/v1/zilliqa/stats')
        .query(true)
        .reply(200, ChainStatsMockResponse);

      const fakeTransaction = {
        ...FirstTwoTransactions[0],
        events: [NewDomainEventsWithWrongLabel[0]],
      };

      const transactionInterceptor = nock('https://api.viewblock.io')
        .get(
          `/v1/zilliqa/addresses/${env.APPLICATION.ZILLIQA.ZNS_REGISTRY_CONTRACT}/txs`,
        )
        .query(true)
        .reply(200, [fakeTransaction]);

      await worker.run();
      chainStatsInterceptor.done();
      transactionInterceptor.done();

      // transaction should be stored
      const txFromDb = await ZnsTransaction.findOne({
        hash: fakeTransaction.hash,
      });
      expect(txFromDb).exist;
      expect(txFromDb?.atxuid).to.equal(fakeTransaction.atxuid);
      // domain should not be process or added to the db due to wrong label
      const domainFromDb = await Domain.findOne({
        name: fakeTransaction.events[0].params.label + '.zil',
      });
      expect(domainFromDb).to.not.exist;
    });

    it('label in newDomain event should not be empty', async () => {
      worker = new ZnsWorker({ perPage: 2 });
      const chainStatsInterceptor = nock('https://api.viewblock.io')
        .get('/v1/zilliqa/stats')
        .query(true)
        .reply(200, ChainStatsMockResponse);

      const fakeTransaction = {
        ...FirstTwoTransactions[0],
        events: [NewDomainEventsWithWrongLabel[1]],
      };

      const transactionInterceptor = nock('https://api.viewblock.io')
        .get(
          `/v1/zilliqa/addresses/${env.APPLICATION.ZILLIQA.ZNS_REGISTRY_CONTRACT}/txs`,
        )
        .query(true)
        .reply(200, [fakeTransaction]);

      await worker.run();
      chainStatsInterceptor.done();
      transactionInterceptor.done();

      // transaction should be stored
      const txFromDb = await ZnsTransaction.findOne({
        hash: fakeTransaction.hash,
      });
      expect(txFromDb).exist;
      expect(txFromDb?.atxuid).to.equal(fakeTransaction.atxuid);
      // domain should not be process or added to the db due to wrong label
      const domainFromDb = await Domain.findOne({
        name: fakeTransaction.events[0].params.label + '.zil',
      });
      expect(domainFromDb).to.not.exist;
    });

    it('label in newDomain event should not be capitalized', async () => {
      worker = new ZnsWorker({ perPage: 2 });
      const chainStatsInterceptor = nock('https://api.viewblock.io')
        .get('/v1/zilliqa/stats')
        .query(true)
        .reply(200, ChainStatsMockResponse);

      const fakeTransaction = {
        ...FirstTwoTransactions[0],
        events: [NewDomainEventsWithWrongLabel[2]],
      };

      const transactionInterceptor = nock('https://api.viewblock.io')
        .get(
          `/v1/zilliqa/addresses/${env.APPLICATION.ZILLIQA.ZNS_REGISTRY_CONTRACT}/txs`,
        )
        .query(true)
        .reply(200, [fakeTransaction]);

      await worker.run();
      chainStatsInterceptor.done();
      transactionInterceptor.done();

      // transaction should be stored
      const txFromDb = await ZnsTransaction.findOne({
        hash: fakeTransaction.hash,
      });
      expect(txFromDb).exist;
      expect(txFromDb?.atxuid).to.equal(fakeTransaction.atxuid);
      // domain should not be process or added to the db due to wrong label
      const domainFromDb = await Domain.findOne({
        name: fakeTransaction.events[0].params.label + '.zil',
      });
      expect(domainFromDb).to.not.exist;
    });

    it('should continue to parse the tx even if one of the newDomain events are failed', async () => {
      worker = new ZnsWorker({ perPage: 2 });
      const chainStatsInterceptor = nock('https://api.viewblock.io')
        .get('/v1/zilliqa/stats')
        .query(true)
        .reply(200, ChainStatsMockResponse);

      const fakeTransaction = {
        ...FirstTwoTransactions[0],
        events: [NewDomainEventsWithWrongLabel[0]],
      };

      const secondFakeTransaction = {
        ...FirstTwoTransactions[1],
        events: [
          {
            address: 'zil1jcgu2wlx6xejqk9jw3aaankw6lsjzeunx2j0jz',
            name: 'NewDomain',
            details: 'NewDomain (ByStr32 parent, String label)',
            params: {
              parent:
                '0x9915d0456b878862e822e2361da37232f626a2e47505c8795134a95d36138ed3',
              label: 'sometestdomain',
            },
          },
        ],
      };

      const transactionInterceptor = nock('https://api.viewblock.io')
        .get(
          `/v1/zilliqa/addresses/${env.APPLICATION.ZILLIQA.ZNS_REGISTRY_CONTRACT}/txs`,
        )
        .query(true)
        .reply(200, [fakeTransaction, secondFakeTransaction]);

      const loopEndingTransactionInterceotor = nock('https://api.viewblock.io')
        .get(
          `/v1/zilliqa/addresses/${env.APPLICATION.ZILLIQA.ZNS_REGISTRY_CONTRACT}/txs?network=${env.APPLICATION.ZILLIQA.NETWORK}&events=true&atxuidFrom=2&atxuidTo=3`,
        )
        .reply(200, []);

      await worker.run();
      chainStatsInterceptor.done();
      transactionInterceptor.done();
      loopEndingTransactionInterceotor.done();
      // transaction should be stored
      const txFromDb = await ZnsTransaction.findOne({
        hash: fakeTransaction.hash,
      });
      expect(txFromDb).exist;
      expect(txFromDb?.atxuid).to.equal(fakeTransaction.atxuid);
      // domain should not be process or added to the db due to wrong label
      const domainFromDb = await Domain.findOne({
        name: fakeTransaction.events[0].params.label + '.zil',
      });
      expect(domainFromDb).to.not.exist;

      // second transaction should be stored
      const secondTxFromDb = await ZnsTransaction.findOne({
        hash: secondFakeTransaction.hash,
      });
      expect(secondTxFromDb).exist;
      expect(secondTxFromDb?.atxuid).to.equal(secondFakeTransaction.atxuid);

      const secondDomainFromDb = await Domain.findOne({
        name: secondFakeTransaction.events[0].params.label + '.zil',
      });
      expect(secondDomainFromDb).exist;
    });
  });

  it('should parse the fake transaction', async () => {
    const manager = getManager();
    // const mock = mocks.getMockForTest('should parse the fake transaction');
    const fakeTransaction = {
      hash:
        '0xfc7b8fa3576fba44527b54264adbe8197c1c9fcc3484e764d54064dfe6be8939',
      blockNumber: 247856,
      atxuid: 0,
      events: [
        {
          name: 'Configured',
          params: {
            node:
              '0xd81a54e6c75997b2bbd27a0c0d5afa898eae62dbfc3c178964bcceea0c009b3c',
            owner: 'zil1p3aevv8h2s3u48hm523cd59udgpfyupwt2yaqp',
            resolver: 'zil1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq9yf6pz',
          },
        },
        {
          name: 'NewDomain',
          params: {
            parent:
              '0x9915d0456b878862e822e2361da37232f626a2e47505c8795134a95d36138ed3',
            label: 'activating',
          },
        },
      ],
    };
    const spy = nock('https://dev-api.zilliqa.com/')
      .post('/')
      .reply(200, {
        error: {
          code: -5,
          data: null,
          message: 'Address not contract address',
        },
        id: 1,
        jsonrpc: '2.0',
      });
    await worker['processTransaction'](fakeTransaction as ZnsTx, manager);
    spy.done();
    const txFromDb = await ZnsTransaction.findOne({
      hash: fakeTransaction.hash,
    });
    expect(txFromDb).exist;
    expect(txFromDb?.atxuid).eq(0);
    expect(txFromDb?.events.length).eq(2);
    expect(txFromDb?.blockNumber).eq(247856);
    const domainFromDb = await Domain.findOne({ name: 'activating.zil' });
    expect(domainFromDb).exist;
    expect(domainFromDb?.ownerAddress).eq(
      '0x0c7b9630f75423ca9efba2a386d0bc6a0292702e',
    );
    expect(domainFromDb?.resolver).eq(null);
    expect(domainFromDb?.node).eq(
      '0xd81a54e6c75997b2bbd27a0c0d5afa898eae62dbfc3c178964bcceea0c009b3c',
    );
    expect(domainFromDb?.location).eq('ZNS');
  });
});
