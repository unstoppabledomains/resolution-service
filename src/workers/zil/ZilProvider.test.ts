import { expect } from 'chai';
import ZilProvider from './ZilProvider';
import firstTwoTransactions from '../../../mocks/zns/firstTwoTransactions.json';
import nock from 'nock';

let provider: ZilProvider;

describe('ZilProvider', () => {
  beforeEach(() => {
    provider = new ZilProvider();
  });

  it('should init', async () => {
    expect(provider).exist;
  });

  it('should return first 2 transactions', async () => {
    const interceptor = nock('https://api.viewblock.io')
      .get(
        '/v1/zilliqa/addresses/0xB925adD1d5EaF13f40efD43451bF97A22aB3d727/txs',
      )
      .query({
        network: 'testnet',
        events: true,
        atxuidFrom: 0,
        atxuidTo: 1,
      })
      .reply(200, firstTwoTransactions);
    const transactions = await provider.getLatestTransactions(0, 1);
    interceptor.done();
    const firstTx = {
      hash: '0x8ddd3f31d79c2c40f03a38e5fc645df945419c8679064e05bc50f08e23dec5be',
      blockNumber: 2566938,
      atxuid: 0,
      events: [],
    };
    const secondTx = {
      hash: '0x47e5d1f098d00c46341e92c6cfc052cecf80c4bb6a69405911bd406b6d56d069',
      blockNumber: 2566944,
      atxuid: 1,
      events: [
        {
          address: 'zil1hyj6m5w4atcn7s806s69r0uh5g4t84e8gp6nps',
          name: 'AdminSet',
          details: 'AdminSet (ByStr20 address, Bool isApproved)',
          params: {
            address: 'zil1qs2epy722w8wm07svl8uuwqrdlqya6gt5xpdc4',
            isApproved: 'True',
          },
        },
      ],
    };
    expect(transactions.length).eq(2);
    expect(transactions[0]).deep.eq(firstTx);
    expect(transactions[1]).deep.eq(secondTx);
  });

  it('should return records for the domain', async () => {
    const resolverAddress = '0xaec2202caff6b5b637c18ecf7fdf4959a48c7914'; // flowers.zil
    const interceptor = nock('https://dev-api.zilliqa.com/')
      .post('/')
      .reply(200, {
        id: 1,
        jsonrpc: '2.0',
        result: {
          records: {
            'crypto.ZIL.address': '0x2fbe7652d33bfaf72e50f0ea926c42c8c89344f4',
          },
        },
      });

    const records = await provider.requestZilliqaResolutionFor(resolverAddress);
    interceptor.done();
    const answer = {
      'crypto.ZIL.address': '0x2fbe7652d33bfaf72e50f0ea926c42c8c89344f4',
    };
    expect(records).deep.eq(answer);
  });
});
