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
          number: '0x4b7', // 1207
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
