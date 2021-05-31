import supertest from 'supertest';
import { api } from '../api';
import { expect } from 'chai';
import nock from 'nock';
import { WorkerStatus } from '../models';

describe('StatusController', () => {
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
      .reply(200, {
        id: 83,
        jsonrpc: '2.0',
        result: '0x4b7', // 1207
      });

    await WorkerStatus.saveWorkerStatus(
      'CNS',
      expectedStatus.CNS.latestMirroredBlock,
      {},
    );
    await WorkerStatus.saveWorkerStatus(
      'ZNS',
      expectedStatus.ZNS.latestMirroredBlock,
      {},
    );

    const res = await supertest(api).get('/status').send();

    viewBlockInterceptor.done();
    jsonRpcInterceptor.done();

    expect(res.body).containSubset(expectedStatus);
    expect(res.status).eq(200);
  });
});
