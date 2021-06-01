import supertest from 'supertest';
import { api } from '../api';
import { expect } from 'chai';
import nock from 'nock';
import { WorkerStatus } from '../models';

describe('StatusController', () => {
  before(() => {
    nock.disableNetConnect(); // We need to disable connection to localhost since we are mocking requests to it
    nock.enableNetConnect('127.0.0.1');
  });

  after(() => {
    nock.cleanAll();
    nock.disableNetConnect();
    nock.enableNetConnect((host) => {
      return host.includes('127.0.0.1') || host.includes('localhost'); // re-enable connection
    });
  });

  it('should return appropriate block counts', async () => {
    const expectedStatus = {
      CNS: {
        latestMirroredBlock: 1101,
        latestNetworkBlock: 1207,
      },
      ZNS: {
        latestMirroredBlock: 171102,
        latestNetworkBlock: 1234,
      },
    };

    const viewBlockInterceptor = nock('https://api.viewblock.io')
      .get('/v1/zilliqa/stats')
      .query({
        network: 'testnet',
      })
      .reply(200, { txHeight: expectedStatus.ZNS.latestNetworkBlock });

    const jsonRpcInterceptor = nock('http://localhost:8545')
      .post('/', {
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: /^\d+$/,
      })
      .reply(200, (uri, requestBody) => ({
        id: 1,
        jsonrpc: '2.0',
        result: '0x4b7', // 1207
      }));

    await WorkerStatus.saveWorkerStatus(
      'CNS',
      expectedStatus.CNS.latestMirroredBlock,
      undefined,
    );
    await WorkerStatus.saveWorkerStatus(
      'ZNS',
      expectedStatus.ZNS.latestMirroredBlock,
      undefined,
    );

    const res = await supertest(api).get('/status').send();

    viewBlockInterceptor.done();
    jsonRpcInterceptor.done();

    expect(res.body).containSubset(expectedStatus);
    expect(res.status).eq(200);
  });
});
