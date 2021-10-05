import supertest from 'supertest';
import { api } from '../api';
import { expect } from 'chai';
import nock from 'nock';
import { WorkerStatus } from '../models';
import * as sinon from 'sinon';
import * as ProviderModule from '../workers/EthereumProvider';

describe('StatusController', () => {
  const sinonSandbox = sinon.createSandbox();
  const mockJsonRpcProviderUrl = 'http://test.jsonrpc.provider:8545';

  before(() => {
    sinonSandbox // Nock behaves really weirdly when mocking localhost, so we mock the provider to not use localhost at all
      .stub(ProviderModule, 'EthereumProvider')
      .value(
        new ProviderModule.StaticJsonRpcProvider(mockJsonRpcProviderUrl, {
          name: '',
          chainId: 99,
        }),
      );
  });

  after(() => {
    sinonSandbox.restore();
  });

  it('should return appropriate block counts', async () => {
    const expectedStatus = {
      blockchain: {
        ETH: {
          latestMirroredBlock: 1101,
          latestNetworkBlock: 1207,
          networkId: 1337,
        },
        ZIL: {
          latestMirroredBlock: 171102,
          latestNetworkBlock: 1234,
          networkId: 333,
        },
      },
    };

    const viewBlockInterceptor = nock('https://api.viewblock.io')
      .get('/v1/zilliqa/stats')
      .query({
        network: 'testnet',
      })
      .reply(200, {
        txHeight: expectedStatus.blockchain.ZIL.latestNetworkBlock,
      });

    const jsonRpcInterceptor = nock(mockJsonRpcProviderUrl)
      .post('/', {
        jsonrpc: '2.0',
        method: 'eth_getBlockByNumber',
        params: ['latest', false],
        id: /^\d+$/,
      })
      .reply(200, (uri, requestBody) => ({
        id: 1,
        jsonrpc: '2.0',
        result: {
          //dummy block structure, since we request the whole block
          difficulty: 3849295379889,
          extraData:
            '0x476574682f76312e302e312d39383130306634372f6c696e75782f676f312e34',
          gasLimit: '0x3141592',
          gasUsed: '0x21000',
          hash:
            '0xf93283571ae16dcecbe1816adc126954a739350cd1523a1559eabeae155fbb63',
          miner: '0x909755D480A27911cB7EeeB5edB918fae50883c0',
          nonce: '0x1a455280001cc3f8',
          number: 1207,
          parentHash:
            '0x73d88d376f6b4d232d70dc950d9515fad3b5aa241937e362fdbfd74d1c901781',
          timestamp: 1439799168,
          transactions: [
            '0x6f12399cc2cb42bed5b267899b08a847552e8c42a64f5eb128c1bcbd1974fb0c',
          ],
        },
      }));
    await WorkerStatus.saveWorkerStatus(
      'ETH',
      expectedStatus.blockchain.ETH.latestMirroredBlock,
      undefined,
      undefined,
    );
    await WorkerStatus.saveWorkerStatus(
      'ZIL',
      expectedStatus.blockchain.ZIL.latestMirroredBlock,
      undefined,
      undefined,
    );

    const res = await supertest(api).get('/status').send();

    viewBlockInterceptor.done();
    jsonRpcInterceptor.done();

    expect(res.body).containSubset(expectedStatus);
    expect(res.status).eq(200);
  });
});
