import supertest from 'supertest';
import { api } from '../api';
import { expect } from 'chai';
import { ApiKey } from '../models';
import { DomainTestHelper } from '../utils/testing/DomainTestHelper';
import { znsNamehash, eip137Namehash } from '../utils/namehash';
import { env } from '../env';
import { getConnection } from 'typeorm';
import { Blockchain } from '../types/common';
import { ETHContracts } from '../contracts';
import { describe } from 'mocha';

describe('DomainsController', () => {
  let testApiKey: ApiKey;

  beforeEach(async () => {
    testApiKey = await ApiKey.createApiKey('testing key');
  });

  describe('GET /domain/:domainName', () => {
    it('should return correct domain resolution for L2 domain on L1', async () => {
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
      await domain.save();

      const res = await supertest(api)
        .get('/domains/brad.crypto')
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

    it('should return correct domain resolution for L2 domain', async () => {
      const { domain } = await DomainTestHelper.createTestDomain({
        name: 'brad.crypto',
        node: '0x756e4e998dbffd803c21d23b06cd855cdc7a4b57706c95964a37e24b47c10fc9',
        ownerAddress: '0x0000000000000000000000000000000000000000',
        blockchain: Blockchain.ETH,
        networkId: 1337,
        registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
        resolution: {},
        resolver: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
      });
      const resolution = domain.getResolution(Blockchain.MATIC, 1337);
      resolution.ownerAddress = '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8';
      resolution.resolver = '0xa9a6a3626993d487d2dbda3173cf58ca1a9d9e9f';
      resolution.registry = '0xa9a6a3626993d487d2dbda3173cf58ca1a9d9e9f';
      resolution.resolution = {
        'crypto.ETH.address': '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
      };
      domain.setResolution(resolution);
      await domain.save();

      const res = await supertest(api)
        .get('/domains/brad.crypto')
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.status).eq(200);
      expect(res.body).containSubset({
        meta: {
          domain: 'brad.crypto',
          owner: '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
          resolver: '0xa9a6a3626993d487d2dbda3173cf58ca1a9d9e9f',
          registry: '0xa9a6a3626993d487d2dbda3173cf58ca1a9d9e9f',
          blockchain: 'MATIC',
          networkId: 1337,
        },
        records: {
          'crypto.ETH.address': '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
        },
      });
    });

    it('should return error for unauthorized query', async () => {
      const res = await supertest(api).get('/domains/brad.crypto').send();
      expect(res.status).eq(403);
      expect(res.body).containSubset({
        message: 'Please provide a valid API key.',
      });
    });

    it('should return non-minted domain', async () => {
      const res = await supertest(api)
        .get('/domains/unminted-long-domain.crypto')
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.body).containSubset({
        meta: {
          domain: 'unminted-long-domain.crypto',
          owner: null,
          resolver: null,
          registry: null,
          blockchain: null,
          networkId: null,
        },
        records: {},
      });
      expect(res.status).eq(200);
    });

    it('should return non-minted domain when used a wrong tld', async () => {
      const res = await supertest(api)
        .get('/domains/bobby.funnyrabbit')
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.status).eq(200);
      expect(res.body).containSubset({
        meta: {
          domain: 'bobby.funnyrabbit',
          owner: null,
          resolver: null,
          registry: null,
          blockchain: null,
          networkId: null,
        },
        records: {},
      });
    });

    it('should return correct domain resolution for domain in lowercase', async () => {
      await DomainTestHelper.createTestDomain({
        name: 'testdomainforcase.crypto',
        node: '0x08c2e9d2a30aa81623fcc758848d5556696868222fbc80a15ca46ec2fe2cba4f',
        ownerAddress: '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
        blockchain: Blockchain.ETH,
        networkId: 1337,
        registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
        resolution: {
          'crypto.ETH.address': '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
        },
        resolver: '0xb66DcE2DA6afAAa98F2013446dBCB0f4B0ab2842',
      });
      const res = await supertest(api)
        .get('/domains/TESTdomainforCase.crypto')
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.status).eq(200);
      expect(res.body).containSubset({
        meta: {
          domain: 'testdomainforcase.crypto',
          owner: '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
          resolver: '0xb66DcE2DA6afAAa98F2013446dBCB0f4B0ab2842',
          registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
          blockchain: 'ETH',
          networkId: 1337,
        },
        records: {
          'crypto.ETH.address': '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
        },
      });
    });

    it('should return correct registry for all locations domains', async () => {
      const { domain: znsDomain } = await DomainTestHelper.createTestDomain({
        blockchain: Blockchain.ZIL,
        networkId: env.APPLICATION.ZILLIQA.NETWORK_ID,
        name: 'test.zil',
        node: znsNamehash('test.zil'),
        registry: env.APPLICATION.ZILLIQA.ZNS_REGISTRY_CONTRACT,
      });
      const { domain: cnsDomain } = await DomainTestHelper.createTestDomain();
      const { domain: unsDomain } = await DomainTestHelper.createTestDomain({
        name: 'test.nft',
        node: eip137Namehash('test.nft'),
        registry: ETHContracts.UNSRegistry.address,
        blockchain: Blockchain.ETH,
        networkId: env.APPLICATION.ETHEREUM.NETWORK_ID,
      });

      const znsResult = await supertest(api)
        .get(`/domains/${znsDomain.name}`)
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(znsResult.status).eq(200);
      expect(znsResult.body.meta.registry).eq(
        env.APPLICATION.ZILLIQA.ZNS_REGISTRY_CONTRACT,
      );

      const cnsResult = await supertest(api)
        .get(`/domains/${cnsDomain.name}`)
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(cnsResult.status).eq(200);
      expect(cnsResult.body.meta.registry).eq(ETHContracts.CNSRegistry.address);

      const unsResult = await supertest(api)
        .get(`/domains/${unsDomain.name}`)
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(unsResult.status).eq(200);
      expect(unsResult.body.meta.registry).eq(ETHContracts.UNSRegistry.address);
    });

    it('should return non-minted domain ending on .zil', async () => {
      const res = await supertest(api)
        .get('/domains/notreal134522.zil')
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.status).eq(200);
      expect(res.body).containSubset({
        meta: {
          domain: 'notreal134522.zil',
          owner: null,
          resolver: null,
          registry: null,
          blockchain: null,
          networkId: null,
        },
        records: {},
      });
    });

    it('should return minted domain ending on .zil', async () => {
      await DomainTestHelper.createTestDomain({
        blockchain: Blockchain.ZIL,
        networkId: env.APPLICATION.ZILLIQA.NETWORK_ID,
        name: 'sometestforzil.zil',
        ownerAddress: '0xcea21f5a6afc11b3a4ef82e986d63b8b050b6910',
        resolver: '0x34bbdee3404138430c76c2d1b2d4a2d223a896df',
        registry: '0x9611c53be6d1b32058b2747bdececed7e1216793',
        node: '0x8052ef7b6b4eee4bc0d7014f0e216db6270bf0055bcd3582368601f2de5e60f0',
        resolution: {},
      });
      const res = await supertest(api)
        .get('/domains/sometestforzil.zil')
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.status).eq(200);
      expect(res.body).containSubset({
        meta: {
          domain: 'sometestforzil.zil',
          owner: '0xcea21f5a6afc11b3a4ef82e986d63b8b050b6910',
          resolver: '0x34bbdee3404138430c76c2d1b2d4a2d223a896df',
          registry: '0x9611c53be6d1b32058b2747bdececed7e1216793',
          blockchain: 'ZIL',
          networkId: 333,
        },
        records: {},
      });
    });

    it('should return zil domain on uns', async () => {
      await DomainTestHelper.createTestDomain({
        blockchain: Blockchain.ETH,
        networkId: env.APPLICATION.ETHEREUM.NETWORK_ID,
        name: 'sometestforzil.zil',
        ownerAddress: '0xcea21f5a6afc11b3a4ef82e986d63b8b050b6910',
        resolver: '0x34bbdee3404138430c76c2d1b2d4a2d223a896df',
        registry: '0x9611c53be6d1b32058b2747bdececed7e1216793',
        node: '0x067b0a0d1db14a412c12c3e48b5a54209744626a74fabdb534da79dbcca52c63',
        resolution: {},
      });
      const res = await supertest(api)
        .get('/domains/sometestforzil.zil')
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.status).eq(200);
      expect(res.body).containSubset({
        meta: {
          domain: 'sometestforzil.zil',
          owner: '0xcea21f5a6afc11b3a4ef82e986d63b8b050b6910',
          resolver: '0x34bbdee3404138430c76c2d1b2d4a2d223a896df',
          registry: '0x9611c53be6d1b32058b2747bdececed7e1216793',
          blockchain: 'ETH',
          networkId: 1337,
        },
        records: {},
      });
    });

    it('should return correct domain resolution for minted .crypto domain', async () => {
      await DomainTestHelper.createTestDomain({
        name: 'brad.crypto',
        ownerAddress: '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
        node: '0x756e4e998dbffd803c21d23b06cd855cdc7a4b57706c95964a37e24b47c10fc9',
        registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
        resolution: {
          'gundb.username.value':
            '0x8912623832e174f2eb1f59cc3b587444d619376ad5bf10070e937e0dc22b9ffb2e3ae059e6ebf729f87746b2f71e5d88ec99c1fb3c7c49b8617e2520d474c48e1c',
          'ipfs.html.value': 'QmdyBw5oTgCtTLQ18PbDvPL8iaLoEPhSyzD91q9XmgmAjb',
          'ipfs.redirect_domain.value':
            'https://abbfe6z95qov3d40hf6j30g7auo7afhp.mypinata.cloud/ipfs/Qme54oEzRkgooJbCDr78vzKAWcv6DDEZqRhhDyDtzgrZP6',
          'crypto.ETH.address': '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
          'gundb.public_key.value':
            'pqeBHabDQdCHhbdivgNEc74QO-x8CPGXq4PKWgfIzhY.7WJR5cZFuSyh1bFwx0GWzjmrim0T5Y6Bp0SSK0im3nI',
          'crypto.BTC.address': 'bc1q359khn0phg58xgezyqsuuaha28zkwx047c0c3y',
        },
        resolver: '0xb66DcE2DA6afAAa98F2013446dBCB0f4B0ab2842',
      });

      const res = await supertest(api)
        .get('/domains/brad.crypto')
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();

      expect(res.status).eq(200);
      expect(res.body).containSubset({
        meta: {
          domain: 'brad.crypto',
          owner: '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
          resolver: '0xb66DcE2DA6afAAa98F2013446dBCB0f4B0ab2842',
          registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
          blockchain: 'ETH',
          networkId: 1337,
        },
        records: {
          'gundb.username.value':
            '0x8912623832e174f2eb1f59cc3b587444d619376ad5bf10070e937e0dc22b9ffb2e3ae059e6ebf729f87746b2f71e5d88ec99c1fb3c7c49b8617e2520d474c48e1c',
          'ipfs.html.value': 'QmdyBw5oTgCtTLQ18PbDvPL8iaLoEPhSyzD91q9XmgmAjb',
          'ipfs.redirect_domain.value':
            'https://abbfe6z95qov3d40hf6j30g7auo7afhp.mypinata.cloud/ipfs/Qme54oEzRkgooJbCDr78vzKAWcv6DDEZqRhhDyDtzgrZP6',
          'crypto.ETH.address': '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
          'gundb.public_key.value':
            'pqeBHabDQdCHhbdivgNEc74QO-x8CPGXq4PKWgfIzhY.7WJR5cZFuSyh1bFwx0GWzjmrim0T5Y6Bp0SSK0im3nI',
          'crypto.BTC.address': 'bc1q359khn0phg58xgezyqsuuaha28zkwx047c0c3y',
        },
      });
    });

    it('should return correct domain resolution for L2 domain', async () => {
      const { domain } = await DomainTestHelper.createTestDomain({
        name: 'brad.crypto',
        node: '0x756e4e998dbffd803c21d23b06cd855cdc7a4b57706c95964a37e24b47c10fc9',
        ownerAddress: '0x0000000000000000000000000000000000000000',
        blockchain: Blockchain.ETH,
        networkId: 1337,
        registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
        resolution: {},
        resolver: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
      });
      const resolution = domain.getResolution(Blockchain.MATIC, 1337);
      resolution.ownerAddress = '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8';
      resolution.resolver = '0xa9a6a3626993d487d2dbda3173cf58ca1a9d9e9f';
      resolution.registry = '0xa9a6a3626993d487d2dbda3173cf58ca1a9d9e9f';
      resolution.resolution = {
        'crypto.ETH.address': '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
      };
      domain.setResolution(resolution);
      await domain.save();

      const res = await supertest(api)
        .get('/domains/brad.crypto')
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.status).eq(200);
      expect(res.body).containSubset({
        meta: {
          domain: 'brad.crypto',
          owner: '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
          resolver: '0xa9a6a3626993d487d2dbda3173cf58ca1a9d9e9f',
          registry: '0xa9a6a3626993d487d2dbda3173cf58ca1a9d9e9f',
          blockchain: 'MATIC',
          networkId: 1337,
        },
        records: {
          'crypto.ETH.address': '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
        },
      });
    });

    it('should return correct domain resolution for L2 domain on L1', async () => {
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
      const resolution = await domain.getResolution(Blockchain.MATIC, 1337);
      resolution.ownerAddress = '0x0000000000000000000000000000000000000000';
      resolution.resolver = '0xa9a6a3626993d487d2dbda3173cf58ca1a9d9e9f';
      resolution.registry = '0xa9a6a3626993d487d2dbda3173cf58ca1a9d9e9f';
      resolution.resolution = {};
      domain.setResolution(resolution);
      await domain.save();

      const res = await supertest(api)
        .get('/domains/brad.crypto')
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
  });

  describe('Errors handling', () => {
    it('should format the 500 error', async () => {
      const connection = getConnection();
      connection.close();
      const res = await supertest(api)
        .get('/domains/brad.crypto')
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.status).eq(500);
      expect(res.body.code).to.exist;
      expect(res.body.message).to.exist;
      expect(res.body.errors).to.exist;
      expect(res.body.stack).to.not.exist;
      await connection.connect(); // restore the connection to the db;
    });
  });
});
