import supertest from 'supertest';
import { expect } from 'chai';
import { api } from '../api';
import { env } from '../env';
import { ApiKey, DomainsReverseResolution } from '../models';
import { Blockchain } from '../types/common';
import { DomainTestHelper } from '../utils/testing/DomainTestHelper';

describe('ReverseController', () => {
  const reverseAddress = '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8';
  let testApiKey: ApiKey;

  beforeEach(async () => {
    const { domain } = await DomainTestHelper.createTestDomain({
      name: 'brad.crypto',
      node: '0x756e4e998dbffd803c21d23b06cd855cdc7a4b57706c95964a37e24b47c10fc9',
      ownerAddress: '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
      blockchain: Blockchain.ETH,
      networkId: 1337,
      registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
      resolution: {
        'crypto.ETH.address': '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
      },
      resolver: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
    });

    const resolution = domain.getResolution(Blockchain.MATIC, 1337);
    resolution.ownerAddress = '0x0000000000000000000000000000000000000000';
    resolution.resolver = '0xa9a6a3626993d487d2dbda3173cf58ca1a9d9e9f';
    resolution.registry = '0xa9a6a3626993d487d2dbda3173cf58ca1a9d9e9f';
    resolution.resolution = {};
    domain.setResolution(resolution);

    const reverse = new DomainsReverseResolution({
      blockchain: Blockchain.ETH,
      networkId: env.APPLICATION.ETHEREUM.NETWORK_ID,
      reverseAddress: reverseAddress.toLowerCase(),
    });
    domain.setReverseResolution(reverse);
    await domain.save();

    testApiKey = await ApiKey.createApiKey('testing key');
  });

  it('should require api key', async () => {
    const res = await supertest(api).get(`/reverse/${reverseAddress}`).send();

    expect(res.status).eq(403);
  });

  it('should return domain for reverse resolution', async () => {
    const res = await supertest(api)
      .get(`/reverse/${reverseAddress}`)
      .auth(testApiKey.apiKey, { type: 'bearer' })
      .send();

    expect(res.status).eq(200);
    expect(res.body).containSubset({
      meta: {
        domain: 'brad.crypto',
        owner: '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
        resolver: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
        registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
        blockchain: 'ETH',
        networkId: 1337,
      },
      records: {
        'crypto.ETH.address': '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
      },
    });
  });

  it('should return empty response for non existing reverse resolution', async () => {
    const emptyAddress = '0x1234567890123456789012345678901234567890';
    const res = await supertest(api)
      .get(`/reverse/${emptyAddress}`)
      .auth(testApiKey.apiKey, { type: 'bearer' })
      .send();

    expect(res.status).eq(200);
    expect(res.body).containSubset({
      meta: {
        domain: '',
        owner: null,
        resolver: null,
        registry: null,
        blockchain: null,
        networkId: null,
      },
      records: {},
    });
  });
});
