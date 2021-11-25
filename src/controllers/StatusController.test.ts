import supertest from 'supertest';
import { api } from '../api';
import { expect } from 'chai';
import nock from 'nock';
import { WorkerStatus } from '../models';
import * as sinon from 'sinon';
import * as ProviderModule from '../workers/EthereumProvider';
import { Blockchain } from '../types/common';

const mockEthJsonRpcProviderUrl = 'http://test.jsonrpc.provider:8545';
const mockMaticJsonRpcProviderUrl = 'http://test.jsonrpc.provider:8546';

describe('StatusController', () => {
  const sinonSandbox = sinon.createSandbox();

  before(() => {
    sinonSandbox // Nock behaves really weirdly when mocking localhost, so we mock the provider to not use localhost at all
      .stub(ProviderModule, 'EthereumProvider')
      .value(
        new ProviderModule.StaticJsonRpcProvider(mockEthJsonRpcProviderUrl, {
          name: '',
          chainId: 99,
        }),
      );

    sinonSandbox // Nock behaves really weirdly when mocking localhost, so we mock the provider to not use localhost at all
      .stub(ProviderModule, 'MaticProvider')
      .value(
        new ProviderModule.StaticJsonRpcProvider(mockMaticJsonRpcProviderUrl, {
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
          acceptableDelayInBlocks: 100,
          latestMirroredBlock: 901,
          latestNetworkBlock: 1207,
          networkId: 1337,
          isUpToDate: false,
        },
        MATIC: {
          acceptableDelayInBlocks: 100,
          latestMirroredBlock: 12145,
          latestNetworkBlock: 12375,
          networkId: 1337,
          isUpToDate: false,
        },
        ZIL: {
          acceptableDelayInBlocks: 200,
          latestMirroredBlock: 171102,
          latestNetworkBlock: 171303,
          networkId: 333,
          isUpToDate: false,
        },
      },
    };

    const viewBlockInterceptor = createViewBlockInterceptor(
      expectedStatus.blockchain.ZIL.latestNetworkBlock,
    );
    const jsonRpcInterceptor = createEthereumInterceptor(
      expectedStatus.blockchain.ETH.latestNetworkBlock,
    );
    const maticRpcInterceptor = createMaticInterceptor(
      expectedStatus.blockchain.MATIC.latestNetworkBlock,
    );
    await WorkerStatus.saveWorkerStatus(
      Blockchain.ETH,
      expectedStatus.blockchain.ETH.latestMirroredBlock,
      undefined,
      undefined,
    );
    await WorkerStatus.saveWorkerStatus(
      Blockchain.MATIC,
      expectedStatus.blockchain.MATIC.latestMirroredBlock,
      undefined,
      undefined,
    );
    await WorkerStatus.saveWorkerStatus(
      Blockchain.ZIL,
      expectedStatus.blockchain.ZIL.latestMirroredBlock,
      undefined,
      undefined,
    );

    const res = await supertest(api).get('/status').send();

    viewBlockInterceptor.done();
    jsonRpcInterceptor.done();
    maticRpcInterceptor.done();

    expect(res.body).containSubset(expectedStatus);
    expect(res.status).eq(200);
  });

  it("should return isUpToDate = false if ETH and ZIL mirror aren't up to date", async () => {
    const latestNetworkBlock = 301;
    const latestMirroredBlock = 100;
    const viewBlockInterceptor = createViewBlockInterceptor(latestNetworkBlock);
    const jsonRpcInterceptor = createEthereumInterceptor(latestNetworkBlock);
    const maticRpcInterceptor = createMaticInterceptor(latestNetworkBlock);
    await WorkerStatus.saveWorkerStatus(
      Blockchain.ETH,
      latestMirroredBlock,
      undefined,
      undefined,
    );
    await WorkerStatus.saveWorkerStatus(
      Blockchain.MATIC,
      latestMirroredBlock,
      undefined,
      undefined,
    );
    await WorkerStatus.saveWorkerStatus(
      Blockchain.ZIL,
      latestMirroredBlock,
      undefined,
      undefined,
    );
    const res = await supertest(api).get('/status').send();
    viewBlockInterceptor.done();
    jsonRpcInterceptor.done();
    maticRpcInterceptor.done();
    expect(res.status).eq(200);
    expect(res.body.blockchain.ETH.isUpToDate).to.be.false;
    expect(res.body.blockchain.MATIC.isUpToDate).to.be.false;
    expect(res.body.blockchain.ZIL.isUpToDate).to.be.false;
  });

  it('should return isUpToDate = true if ZNS and ETH mirror are up to date', async () => {
    const latestNetworkBlock = 200;
    const latestMirroredBlock = 123;
    const viewBlockInterceptor = createViewBlockInterceptor(latestNetworkBlock);
    const jsonRpcInterceptor = createEthereumInterceptor(latestNetworkBlock);
    const maticRpcInterceptor = createMaticInterceptor(latestNetworkBlock);
    await WorkerStatus.saveWorkerStatus(
      Blockchain.ETH,
      latestMirroredBlock,
      undefined,
      undefined,
    );
    await WorkerStatus.saveWorkerStatus(
      Blockchain.MATIC,
      latestMirroredBlock,
      undefined,
      undefined,
    );
    await WorkerStatus.saveWorkerStatus(
      Blockchain.ZIL,
      latestMirroredBlock,
      undefined,
      undefined,
    );
    const res = await supertest(api).get('/status').send();
    viewBlockInterceptor.done();
    jsonRpcInterceptor.done();
    maticRpcInterceptor.done();
    expect(res.status).eq(200);
    expect(res.body.blockchain.ETH.isUpToDate).to.be.true;
    expect(res.body.blockchain.MATIC.isUpToDate).to.be.true;
    expect(res.body.blockchain.ZIL.isUpToDate).to.be.true;
  });

  it("should return isUpToDate = false if ETH mirror isn't up to date", async () => {
    const latestNetworkBlock = 200;
    const latestMirroredBlock = 120;
    const viewBlockInterceptor = createViewBlockInterceptor(latestNetworkBlock);
    const jsonRpcInterceptor = createEthereumInterceptor(latestNetworkBlock);
    const maticRpcInterceptor = createMaticInterceptor(latestNetworkBlock);
    await WorkerStatus.saveWorkerStatus(
      Blockchain.ETH,
      latestMirroredBlock - 100,
      undefined,
      undefined,
    );
    await WorkerStatus.saveWorkerStatus(
      Blockchain.MATIC,
      latestMirroredBlock,
      undefined,
      undefined,
    );
    await WorkerStatus.saveWorkerStatus(
      Blockchain.ZIL,
      latestMirroredBlock,
      undefined,
      undefined,
    );
    const res = await supertest(api).get('/status').send();
    viewBlockInterceptor.done();
    jsonRpcInterceptor.done();
    maticRpcInterceptor.done();
    expect(res.status).eq(200);
    expect(res.body.blockchain.ETH.isUpToDate).to.be.false;
    expect(res.body.blockchain.MATIC.isUpToDate).to.be.true;
    expect(res.body.blockchain.ZIL.isUpToDate).to.be.true;
  });

  it("should return isUpToDate = false if ZNS mirror isn't up to date", async () => {
    const latestNetworkBlock = 300;
    const latestMirroredBlock = 220;
    const viewBlockInterceptor = createViewBlockInterceptor(latestNetworkBlock);
    const jsonRpcInterceptor = createEthereumInterceptor(latestNetworkBlock);
    const maticRpcInterceptor = createMaticInterceptor(latestNetworkBlock);
    await WorkerStatus.saveWorkerStatus(
      Blockchain.ETH,
      latestMirroredBlock,
      undefined,
      undefined,
    );
    await WorkerStatus.saveWorkerStatus(
      Blockchain.MATIC,
      latestMirroredBlock,
      undefined,
      undefined,
    );
    await WorkerStatus.saveWorkerStatus(
      Blockchain.ZIL,
      latestMirroredBlock - 200,
      undefined,
      undefined,
    );
    const res = await supertest(api).get('/status').send();
    viewBlockInterceptor.done();
    jsonRpcInterceptor.done();
    maticRpcInterceptor.done();
    expect(res.status).eq(200);
    expect(res.body.blockchain.ETH.isUpToDate).to.be.true;
    expect(res.body.blockchain.MATIC.isUpToDate).to.be.true;
    expect(res.body.blockchain.ZIL.isUpToDate).to.be.false;
  });

  it("should return isUpToDate = false if MATIC mirror isn't up to date", async () => {
    const latestNetworkBlock = 300;
    const latestMirroredBlock = 220;
    const viewBlockInterceptor = createViewBlockInterceptor(latestNetworkBlock);
    const jsonRpcInterceptor = createEthereumInterceptor(latestNetworkBlock);
    const maticRpcInterceptor = createMaticInterceptor(latestNetworkBlock);
    await WorkerStatus.saveWorkerStatus(
      Blockchain.ETH,
      latestMirroredBlock,
      undefined,
      undefined,
    );
    await WorkerStatus.saveWorkerStatus(
      Blockchain.MATIC,
      latestMirroredBlock - 100,
      undefined,
      undefined,
    );
    await WorkerStatus.saveWorkerStatus(
      Blockchain.ZIL,
      latestMirroredBlock,
      undefined,
      undefined,
    );
    const res = await supertest(api).get('/status').send();
    viewBlockInterceptor.done();
    jsonRpcInterceptor.done();
    maticRpcInterceptor.done();
    expect(res.status).eq(200);
    expect(res.body.blockchain.ETH.isUpToDate).to.be.true;
    expect(res.body.blockchain.MATIC.isUpToDate).to.be.false;
    expect(res.body.blockchain.ZIL.isUpToDate).to.be.true;
  });

  it('should return ok for /liveness_check and /readiness_check endpoints', async () => {
    const expectedResponse = { status: 'ok' };
    const livenessCheck = await supertest(api).get('/liveness_check').send();
    const readinessCheck = await supertest(api).get('/readiness_check').send();
    expect(livenessCheck.body).containSubset(expectedResponse);
    expect(readinessCheck.body).containSubset(expectedResponse);
  });
});

function createViewBlockInterceptor(networkBlockNumber: number) {
  return nock('https://api.viewblock.io')
    .get('/v1/zilliqa/stats')
    .query({
      network: 'testnet',
    })
    .reply(200, generateViewBlockResponse(networkBlockNumber));
}

function createEthereumInterceptor(networkBlockNumber: number) {
  return nock(mockEthJsonRpcProviderUrl)
    .post('/', {
      jsonrpc: '2.0',
      method: 'eth_getBlockByNumber',
      params: ['latest', false],
      id: /^\d+$/,
    })
    .reply(200, () => generateEthRpcResponse(networkBlockNumber));
}

function createMaticInterceptor(networkBlockNumber: number) {
  return nock(mockMaticJsonRpcProviderUrl)
    .post('/', {
      jsonrpc: '2.0',
      method: 'eth_getBlockByNumber',
      params: ['latest', false],
      id: /^\d+$/,
    })
    .reply(200, () => generateEthRpcResponse(networkBlockNumber));
}

function generateViewBlockResponse(networkBlockNumber: number) {
  return {
    txHeight: networkBlockNumber,
  };
}

function generateEthRpcResponse(networkBlockNumber: number) {
  return {
    id: 1,
    jsonrpc: '2.0',
    result: {
      //dummy block structure, since we request the whole block
      difficulty: 3849295379889,
      extraData:
        '0x476574682f76312e302e312d39383130306634372f6c696e75782f676f312e34',
      gasLimit: '0x3141592',
      gasUsed: '0x21000',
      hash: '0xf93283571ae16dcecbe1816adc126954a739350cd1523a1559eabeae155fbb63',
      miner: '0x909755D480A27911cB7EeeB5edB918fae50883c0',
      nonce: '0x1a455280001cc3f8',
      number: networkBlockNumber,
      parentHash:
        '0x73d88d376f6b4d232d70dc950d9515fad3b5aa241937e362fdbfd74d1c901781',
      timestamp: 1439799168,
      transactions: [
        '0x6f12399cc2cb42bed5b267899b08a847552e8c42a64f5eb128c1bcbd1974fb0c',
      ],
    },
  };
}
