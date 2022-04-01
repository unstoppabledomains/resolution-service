import supertest from 'supertest';
import { api } from '../api';
import { expect } from 'chai';
import { ApiKey, Domain, DomainsResolution } from '../models';
import { DomainTestHelper } from '../utils/testing/DomainTestHelper';
import { env } from '../env';
import { Blockchain } from '../types/common';
import { describe } from 'mocha';

describe('DomainsController', () => {
  let testApiKey: ApiKey;

  beforeEach(async () => {
    testApiKey = await ApiKey.createApiKey('testing key');
  });

  describe('GET /domains', () => {
    it('should return error for unauthorized query', async () => {
      const res = await supertest(api)
        .get('/domains?owners[]=0xC47Ef814093eCefe330604D9E81e3940ae033c9a')
        .send();
      expect(res.status).eq(403);
      expect(res.body).containSubset({
        message: 'Please provide a valid API key.',
      });
    });

    it('should return empty response', async () => {
      const res = await supertest(api)
        .get('/domains?owners[]=0xC47Ef814093eCefe330604D9E81e3940ae033c9a')
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.body).containSubset({
        data: [],
      });
      expect(res.status).eq(200);
    });

    it('should return true for hasMore', async () => {
      const { domain: testDomain } = await DomainTestHelper.createTestDomain({
        name: 'test1.crypto',
        node: '0x99cc72a0f40d092d1b8b3fa8f2da5b7c0c6a9726679112e3827173f8b2460502',
        ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
        registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
      });
      await DomainTestHelper.createTestDomain({
        name: 'test2.crypto',
        node: '0xb899b9e12897c7cea4e24fc4815055b9777ad145507c5e0e1a4edac00b43cf0a',
        ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
        registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
      });

      const res = await supertest(api)
        .get(
          '/domains?owners[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2&perPage=1',
        )
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.body).to.deep.equal({
        data: [
          {
            id: testDomain.name,
            attributes: {
              meta: {
                domain: testDomain.name,
                blockchain: 'ETH',
                networkId: 1337,
                owner: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
                registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
                resolver: '0xb66DcE2DA6afAAa98F2013446dBCB0f4B0ab2842',
              },
              records: {},
            },
          },
        ],
        meta: {
          hasMore: true,
          nextStartingAfter: testDomain.id?.toString(),
          sortBy: 'id',
          sortDirection: 'ASC',
          perPage: 1,
        },
      });
      expect(res.status).eq(200);
    });

    it('should return false for hasMore', async () => {
      const { domain: testDomain } = await DomainTestHelper.createTestDomain({
        name: 'test1.crypto',
        node: '0x99cc72a0f40d092d1b8b3fa8f2da5b7c0c6a9726679112e3827173f8b2460502',
        ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
        registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
      });

      const res = await supertest(api)
        .get(
          '/domains?owners[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2&perPage=1',
        )
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.body).to.deep.equal({
        data: [
          {
            id: testDomain.name,
            attributes: {
              meta: {
                domain: testDomain.name,
                blockchain: 'ETH',
                networkId: 1337,
                owner: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
                registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
                resolver: '0xb66DcE2DA6afAAa98F2013446dBCB0f4B0ab2842',
              },
              records: {},
            },
          },
        ],
        meta: {
          hasMore: false,
          nextStartingAfter: testDomain.id?.toString(),
          sortBy: 'id',
          sortDirection: 'ASC',
          perPage: 1,
        },
      });
      expect(res.status).eq(200);
    });

    it('should return list of test domain', async () => {
      const { domain: testDomain, resolution } =
        await DomainTestHelper.createTestDomain({
          name: 'test1.crypto',
          node: '0x99cc72a0f40d092d1b8b3fa8f2da5b7c0c6a9726679112e3827173f8b2460502',
          ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
          registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
        });

      const res = await supertest(api)
        .get('/domains?owners[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2')
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.body).to.deep.equal({
        data: [
          {
            id: testDomain.name,
            attributes: {
              meta: {
                domain: testDomain.name,
                blockchain: resolution.blockchain,
                networkId: resolution.networkId,
                owner: resolution.ownerAddress,
                registry: resolution.registry,
                resolver: resolution.resolver,
              },
              records: {},
            },
          },
        ],
        meta: {
          hasMore: false,
          perPage: 100,
          nextStartingAfter: testDomain.id?.toString(),
          sortBy: 'id',
          sortDirection: 'ASC',
        },
      });
      expect(res.status).eq(200);
    });

    it('should lowercase ownerAddress', async () => {
      const { domain: testDomain, resolution } =
        await DomainTestHelper.createTestDomain({
          name: 'test.crypto',
          node: '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
          ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
          registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
        });

      const res = await supertest(api)
        .get(
          `/domains?owners[]=${'0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2'.toUpperCase()}`,
        )
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.body).to.deep.equal({
        data: [
          {
            id: testDomain.name,
            attributes: {
              meta: {
                domain: testDomain.name,
                blockchain: resolution.blockchain,
                networkId: resolution.networkId,
                owner: resolution.ownerAddress,
                registry: resolution.registry,
                resolver: resolution.resolver,
              },
              records: {},
            },
          },
        ],
        meta: {
          hasMore: false,
          sortBy: 'id',
          sortDirection: 'ASC',
          perPage: 100,
          nextStartingAfter: testDomain.id?.toString(),
        },
      });
      expect(res.status).eq(200);
    });

    it('should return list of test domains', async () => {
      const { domain: testDomainOne, resolution: resolutionOne } =
        await DomainTestHelper.createTestDomain({
          name: 'test.crypto',
          node: '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
          ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
          registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
        });
      const { domain: testDomainTwo, resolution: resolutionTwo } =
        await DomainTestHelper.createTestDomain({
          name: 'test1.crypto',
          node: '0x99cc72a0f40d092d1b8b3fa8f2da5b7c0c6a9726679112e3827173f8b2460502',
          ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
          registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
        });

      const res = await supertest(api)
        .get('/domains?owners=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2')
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.body.data).to.have.deep.members([
        {
          id: testDomainOne.name,
          attributes: {
            meta: {
              domain: testDomainOne.name,
              blockchain: resolutionOne.blockchain,
              networkId: resolutionOne.networkId,
              owner: resolutionOne.ownerAddress,
              registry: resolutionOne.registry,
              resolver: resolutionOne.resolver,
            },
            records: {},
          },
        },
        {
          id: testDomainTwo.name,
          attributes: {
            meta: {
              domain: testDomainTwo.name,
              blockchain: resolutionTwo.blockchain,
              networkId: resolutionTwo.networkId,
              owner: resolutionTwo.ownerAddress,
              registry: resolutionTwo.registry,
              resolver: resolutionTwo.resolver,
            },
            records: {},
          },
        },
      ]);
      expect(res.status).eq(200);
    });

    it('should return domains for multiple owners', async () => {
      const testDomains = await Promise.all([
        await DomainTestHelper.createTestDomain({
          name: 'test.crypto',
          node: '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
          ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
          registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
        }),
        await DomainTestHelper.createTestDomain({
          name: 'test1.crypto',
          node: '0x99cc72a0f40d092d1b8b3fa8f2da5b7c0c6a9726679112e3827173f8b2460502',
          ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
          registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
        }),
        await DomainTestHelper.createTestDomain({
          name: 'test3.crypto',
          node: '0xde3d1be3661eadd92290828d632e0dd25703b6008cd92d03f51be25795fe922d',
          ownerAddress: '0x111115e932a88b2e7d0130712b3aa9fb7c522222',
          registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
        }),
      ]);

      const expectedDomains = testDomains.map((d) => ({
        id: d.domain.name,
        attributes: {
          meta: {
            domain: d.domain.name,
            blockchain: d.resolution.blockchain,
            networkId: d.resolution.networkId,
            owner: d.resolution.ownerAddress,
            registry: d.resolution.registry,
            resolver: d.resolution.resolver,
          },
          records: {},
        },
      }));

      const res = await supertest(api)
        .get(
          '/domains?owners=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2&owners=0x111115e932a88b2e7d0130712b3aa9fb7c522222',
        )
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.body.data).to.have.deep.members(expectedDomains);
      expect(res.status).eq(200);
    });

    it('should return one domain perPage', async () => {
      const { domain: testDomainOne, resolution: resolutionOne } =
        await DomainTestHelper.createTestDomain({
          name: 'test.crypto',
          node: '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
          ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
          registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
        });
      await DomainTestHelper.createTestDomain({
        blockchain: Blockchain.ZIL,
        networkId: env.APPLICATION.ZILLIQA.NETWORK_ID,
        name: 'test1.zil',
        node: '0xc0cfff0bacee0844926d425ce027c3d05e09afaa285661aca11c5a97639ef001',
        ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
        registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
      });

      const res = await supertest(api)
        .get(
          '/domains?owners[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2&perPage=1',
        )
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.body).to.deep.equal({
        data: [
          {
            id: testDomainOne.name,
            attributes: {
              meta: {
                domain: testDomainOne.name,
                blockchain: resolutionOne.blockchain,
                networkId: resolutionOne.networkId,
                owner: resolutionOne.ownerAddress,
                registry: resolutionOne.registry,
                resolver: resolutionOne.resolver,
              },
              records: {},
            },
          },
        ],
        meta: {
          hasMore: true,
          sortBy: 'id',
          sortDirection: 'ASC',
          perPage: 1,
          nextStartingAfter: testDomainOne.id?.toString(),
        },
      });
      expect(res.status).eq(200);
    });

    it('should return single MATIC resolution for each domain with multiple resolutions', async () => {
      const { domain: domainOne } =
        await DomainTestHelper.createTestDomainWithMultipleResolutions(
          {
            name: 'test.crypto',
            node: '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
            ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
            registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
          },
          {
            name: 'test.crypto',
            node: '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
            ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
            registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
            resolution: {
              'crypto.ETH.address':
                '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
            },
            blockchain: Blockchain.MATIC,
            networkId: env.APPLICATION.POLYGON.NETWORK_ID,
          },
        );
      const { domain: domainTwo } =
        await DomainTestHelper.createTestDomainWithMultipleResolutions(
          {
            name: 'test2.crypto',
            node: '0xb899b9e12897c7cea4e24fc4815055b9777ad145507c5e0e1a4edac00b43cf0a',
            ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
            registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
          },
          {
            name: 'test2.crypto',
            node: '0xb899b9e12897c7cea4e24fc4815055b9777ad145507c5e0e1a4edac00b43cf0a',
            ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
            registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
            resolution: {
              'crypto.ETH.address':
                '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
            },
            blockchain: Blockchain.MATIC,
            networkId: env.APPLICATION.POLYGON.NETWORK_ID,
          },
        );
      const { domain: domainThree } =
        await DomainTestHelper.createTestDomainWithMultipleResolutions(
          {
            name: 'test3.crypto',
            node: '0xde3d1be3661eadd92290828d632e0dd25703b6008cd92d03f51be25795fe922d',
            ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
            registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
          },
          {
            name: 'test3.crypto',
            node: '0xde3d1be3661eadd92290828d632e0dd25703b6008cd92d03f51be25795fe922d',
            ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
            registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
            resolution: {
              'crypto.ETH.address':
                '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
            },
            blockchain: Blockchain.MATIC,
            networkId: env.APPLICATION.POLYGON.NETWORK_ID,
          },
        );
      const { domain: domainFour } =
        await DomainTestHelper.createTestDomainWithMultipleResolutions(
          {
            name: 'test4.crypto',
            node: '0x36f2168288f23c788493ec57064e1e447342670aa096f834b862fed02439d202',
            ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
            registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
          },
          {
            name: 'test4.crypto',
            node: '0x36f2168288f23c788493ec57064e1e447342670aa096f834b862fed02439d202',
            ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
            registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
            resolution: {
              'crypto.ETH.address':
                '0x033dc48B5dB4CA62861643e9D2C411D9eb6D1975',
            },
            blockchain: Blockchain.MATIC,
            networkId: env.APPLICATION.POLYGON.NETWORK_ID,
          },
        );
      const res = await supertest(api)
        .get(`/domains?owners[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2`)
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.body).to.deep.equal({
        data: [
          {
            id: domainOne.name,
            attributes: {
              meta: {
                domain: domainOne.name,
                blockchain: 'MATIC',
                networkId: 1337,
                owner: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
                registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
                resolver: '0xb66DcE2DA6afAAa98F2013446dBCB0f4B0ab2842',
              },
              records: {
                'crypto.ETH.address':
                  '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
              },
            },
          },
          {
            id: domainTwo.name,
            attributes: {
              meta: {
                domain: domainTwo.name,
                blockchain: 'MATIC',
                networkId: 1337,
                owner: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
                registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
                resolver: '0xb66DcE2DA6afAAa98F2013446dBCB0f4B0ab2842',
              },
              records: {
                'crypto.ETH.address':
                  '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
              },
            },
          },
          {
            id: domainThree.name,
            attributes: {
              meta: {
                domain: domainThree.name,
                blockchain: 'MATIC',
                networkId: 1337,
                owner: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
                registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
                resolver: '0xb66DcE2DA6afAAa98F2013446dBCB0f4B0ab2842',
              },
              records: {
                'crypto.ETH.address':
                  '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
              },
            },
          },
          {
            id: domainFour.name,
            attributes: {
              meta: {
                domain: domainFour.name,
                blockchain: 'MATIC',
                networkId: 1337,
                owner: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
                registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
                resolver: '0xb66DcE2DA6afAAa98F2013446dBCB0f4B0ab2842',
              },
              records: {
                'crypto.ETH.address':
                  '0x033dc48B5dB4CA62861643e9D2C411D9eb6D1975',
              },
            },
          },
        ],
        meta: {
          hasMore: false,
          nextStartingAfter: domainFour.id?.toString(),
          perPage: 100,
          sortBy: 'id',
          sortDirection: 'ASC',
        },
      });
      expect(res.status).eq(200);
    });

    it('should return MATIC resolution for domain with multiple resolutions', async () => {
      const { domain } =
        await DomainTestHelper.createTestDomainWithMultipleResolutions(
          {
            name: 'test.crypto',
            node: '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
            ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
            registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
          },
          {
            name: 'test.crypto',
            node: '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
            ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
            registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
            resolution: {
              'crypto.ETH.address':
                '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
            },
            blockchain: Blockchain.MATIC,
            networkId: env.APPLICATION.POLYGON.NETWORK_ID,
          },
        );
      const res = await supertest(api)
        .get(`/domains?owners[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2`)
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.body).to.deep.equal({
        data: [
          {
            id: domain.name,
            attributes: {
              meta: {
                domain: domain.name,
                blockchain: 'MATIC',
                networkId: 1337,
                owner: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
                registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
                resolver: '0xb66DcE2DA6afAAa98F2013446dBCB0f4B0ab2842',
              },
              records: {
                'crypto.ETH.address':
                  '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
              },
            },
          },
        ],
        meta: {
          hasMore: false,
          nextStartingAfter: domain.id?.toString(),
          perPage: 100,
          sortBy: 'id',
          sortDirection: 'ASC',
        },
      });
      expect(res.status).eq(200);
    });
  });

  describe('GET /domains filtering', () => {
    it('filters domains list by tld', async () => {
      const { domain: testDomainOne, resolution: resolutionOne } =
        await DomainTestHelper.createTestDomain({
          name: 'test.crypto',
          node: '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
          ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
          registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
        });

      await DomainTestHelper.createTestDomain({
        blockchain: Blockchain.ZIL,
        networkId: env.APPLICATION.ZILLIQA.NETWORK_ID,
        name: 'test1.zil',
        node: '0xc0cfff0bacee0844926d425ce027c3d05e09afaa285661aca11c5a97639ef001',
        ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
        registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
      });

      const res = await supertest(api)
        .get(
          '/domains?owners=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2&tlds=crypto',
        )
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.body).to.deep.equal({
        data: [
          {
            id: testDomainOne.name,
            attributes: {
              meta: {
                domain: testDomainOne.name,
                blockchain: resolutionOne.blockchain,
                networkId: resolutionOne.networkId,
                owner: resolutionOne.ownerAddress,
                registry: resolutionOne.registry,
                resolver: resolutionOne.resolver,
              },
              records: {},
            },
          },
        ],
        meta: {
          hasMore: false,
          nextStartingAfter: testDomainOne.id?.toString(),
          perPage: 100,
          sortBy: 'id',
          sortDirection: 'ASC',
        },
      });
      expect(res.status).eq(200);
    });

    it('filters domains list by multiple tlds', async () => {
      const { domain: testDomainOne, resolution: resolutionOne } =
        await DomainTestHelper.createTestDomain({
          name: 'test.crypto',
          node: '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
          ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
          registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
        });

      const { domain: testDomainTwo, resolution: resolutionTwo } =
        await DomainTestHelper.createTestDomain({
          blockchain: Blockchain.ZIL,
          networkId: env.APPLICATION.ZILLIQA.NETWORK_ID,
          name: 'test1.zil',
          node: '0xc0cfff0bacee0844926d425ce027c3d05e09afaa285661aca11c5a97639ef001',
          ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
          registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
        });

      const res = await supertest(api)
        .get(
          '/domains?owners=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2&tlds=crypto&tlds=zil',
        )
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.body).to.deep.equal({
        data: [
          {
            id: testDomainOne.name,
            attributes: {
              meta: {
                domain: testDomainOne.name,
                blockchain: resolutionOne.blockchain,
                networkId: resolutionOne.networkId,
                owner: resolutionOne.ownerAddress,
                registry: resolutionOne.registry,
                resolver: resolutionOne.resolver,
              },
              records: {},
            },
          },
          {
            id: testDomainTwo.name,
            attributes: {
              meta: {
                domain: testDomainTwo.name,
                blockchain: resolutionTwo.blockchain,
                networkId: resolutionTwo.networkId,
                owner: resolutionTwo.ownerAddress,
                registry: resolutionTwo.registry,
                resolver: resolutionTwo.resolver,
              },
              records: {},
            },
          },
        ],
        meta: {
          hasMore: false,
          nextStartingAfter: testDomainTwo.id?.toString(),
          perPage: 100,
          sortBy: 'id',
          sortDirection: 'ASC',
        },
      });
      expect(res.status).eq(200);
    });

    it('filters domains list by resolution', async () => {
      const { domain: testDomainOne, resolution: resolutionOne } =
        await DomainTestHelper.createTestDomain({
          name: 'test.crypto',
          node: '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
          ownerAddress: '0x319c860967aa2CF464dCc24dDd93f099d956932e',
          registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
          resolution: {
            'crypto.eth.address': '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
          },
        });

      await DomainTestHelper.createTestDomain({
        blockchain: Blockchain.ZIL,
        networkId: env.APPLICATION.ZILLIQA.NETWORK_ID,
        name: 'test1.zil',
        node: '0xc0cfff0bacee0844926d425ce027c3d05e09afaa285661aca11c5a97639ef001',
        ownerAddress: '0x319c860967aa2CF464dCc24dDd93f099d956932e',
        registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
        resolution: {
          'crypto.eth.address': '0x72c5b3865adCa47C3020e4c8C7BcA221b5F195F4',
        },
      });

      const res = await supertest(api)
        .get(
          '/domains?resolution[crypto.eth.address]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
        )
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.body).to.deep.equal({
        data: [
          {
            id: testDomainOne.name,
            attributes: {
              meta: {
                domain: testDomainOne.name,
                blockchain: resolutionOne.blockchain,
                networkId: resolutionOne.networkId,
                owner: resolutionOne.ownerAddress,
                registry: resolutionOne.registry,
                resolver: resolutionOne.resolver,
              },
              records: resolutionOne.resolution,
            },
          },
        ],
        meta: {
          hasMore: false,
          nextStartingAfter: testDomainOne.id?.toString(),
          perPage: 100,
          sortBy: 'id',
          sortDirection: 'ASC',
        },
      });
      expect(res.status).eq(200);
    });

    it('filters domains list by multiple resolutions', async () => {
      const { domain: testDomainOne, resolution: resolutionOne } =
        await DomainTestHelper.createTestDomain({
          name: 'test.crypto',
          node: '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
          ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
          registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
          resolution: {
            'crypto.eth.address': '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
            'ipfs.html.value': 'QmTiqc12wo2pBsGa9XsbpavkhrjFiyuSWsKyffvZqVGtut',
          },
        });

      await DomainTestHelper.createTestDomain({
        blockchain: Blockchain.ZIL,
        networkId: env.APPLICATION.ZILLIQA.NETWORK_ID,
        name: 'test1.zil',
        node: '0xc0cfff0bacee0844926d425ce027c3d05e09afaa285661aca11c5a97639ef001',
        ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
        registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
        resolution: {
          'crypto.eth.address': '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
        },
      });

      const res = await supertest(api)
        .get(
          '/domains?resolution[crypto.eth.address]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2&resolution[ipfs.html.value]=QmTiqc12wo2pBsGa9XsbpavkhrjFiyuSWsKyffvZqVGtut',
        )
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.body).to.deep.equal({
        data: [
          {
            id: testDomainOne.name,
            attributes: {
              meta: {
                domain: testDomainOne.name,
                blockchain: resolutionOne.blockchain,
                networkId: resolutionOne.networkId,
                owner: resolutionOne.ownerAddress,
                registry: resolutionOne.registry,
                resolver: resolutionOne.resolver,
              },
              records: resolutionOne.resolution,
            },
          },
        ],
        meta: {
          hasMore: false,
          nextStartingAfter: testDomainOne.id?.toString(),
          perPage: 100,
          sortBy: 'id',
          sortDirection: 'ASC',
        },
      });
      expect(res.status).eq(200);
    });

    it('should return no domain from empty startingAfter', async () => {
      const { domain } = await DomainTestHelper.createTestDomain({
        name: 'test.crypto',
        node: '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
        ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
        registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
      });
      const res = await supertest(api)
        .get(
          `/domains?owners[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2&startingAfter=${(
            (domain.id || 0) + 1
          ).toString()}`,
        )
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();
      expect(res.body).to.deep.equal({
        data: [],
        meta: {
          hasMore: false,
          nextStartingAfter: ((domain.id || 0) + 1).toString(),
          perPage: 100,
          sortBy: 'id',
          sortDirection: 'ASC',
        },
      });
      expect(res.status).eq(200);
    });

    it('should return error for incorrect tlds', async () => {
      const res = await supertest(api)
        .get(
          '/domains?owners[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2&tlds=crypto&tlds=test',
        )
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();

      expect(res.status).eq(400);
      expect(res.body.code).to.exist;
      expect(res.body.message).to.exist;
      expect(res.body).to.containSubset({
        code: 'BadRequestError',
        message: "Invalid queries, check 'errors' property for more info.",
        errors: [
          {
            property: 'tlds',
            constraints: {
              'validate tlds with validTlds': 'Invalid TLD list provided',
            },
          },
        ],
      });
    });
  });

  describe('GET /domains sorting', () => {
    let testDomains: {
      domain: Domain;
      resolutions: DomainsResolution[];
    }[] = [];
    // Test domains list:
    // 0: .crypto domain on L1
    // 1: .crypto domain on L2
    // 2: .wallet domain on L1
    // 3: .wallet domain on L2
    // 4: .zil domain on ZNS
    // All domains have same owner and resolution
    beforeEach(async () => {
      testDomains = [];
      testDomains.push(
        await DomainTestHelper.createTestDomainL2(
          {
            name: 'testa.crypto',
            node: '0xc1ff26b9cedbcf2f0408961898aae4ba65e9acd08543eebf7676482c8a23dba8',
          },
          {
            registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
            ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
          },
          {
            registry: '0xa9a6a3626993d487d2dbda3173cf58ca1a9d9e9f',
            ownerAddress: Domain.NullAddress,
          },
        ),
      );

      testDomains.push(
        await DomainTestHelper.createTestDomainL2(
          {
            name: 'testb.crypto',
            node: '0xe952ce3758282cce878760001be22370f4842793139518e119ae04ae24004206',
          },
          {
            registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
            ownerAddress: Domain.NullAddress,
          },
          {
            registry: '0xa9a6a3626993d487d2dbda3173cf58ca1a9d9e9f',
            ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
          },
        ),
      );

      testDomains.push(
        await DomainTestHelper.createTestDomainL2(
          {
            name: 'testa.wallet',
            node: '0x04d4bba9f230ea6c78c1e6b37d268106ac90e0bdcd2dd8322895c0fca5800729',
          },
          {
            registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
            ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
          },
          {
            registry: '0xa9a6a3626993d487d2dbda3173cf58ca1a9d9e9f',
            ownerAddress: Domain.NullAddress,
          },
        ),
      );

      testDomains.push(
        await DomainTestHelper.createTestDomainL2(
          {
            name: 'testb.wallet',
            node: '0xfa8911cd87a6dac8310914c86952e6d451c92e03663cd1190032816a9d59edf3',
          },
          {
            registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe',
            ownerAddress: Domain.NullAddress,
          },
          {
            registry: '0xa9a6a3626993d487d2dbda3173cf58ca1a9d9e9f',
            ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
          },
        ),
      );

      const { domain: zilDomain, resolution: zilResolution } =
        await DomainTestHelper.createTestDomain({
          blockchain: Blockchain.ZIL,
          networkId: env.APPLICATION.ZILLIQA.NETWORK_ID,
          name: 'test1.zil',
          node: '0xc0cfff0bacee0844926d425ce027c3d05e09afaa285661aca11c5a97639ef001',
          ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
          registry: '0xd1e5b0ff1287aa9f9a268759062e4ab08bbeadb',
        });
      testDomains.push({ domain: zilDomain, resolutions: [zilResolution] });
    });

    function getSortedTestDomains(
      sortFunc: (
        a: { domain: Domain; resolution: DomainsResolution },
        b: { domain: Domain; resolution: DomainsResolution },
      ) => number,
    ) {
      const expectedData = testDomains
        .map((dom) => {
          // simple filter to get expected data
          const resolution =
            dom.resolutions[0].ownerAddress ===
            '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2'
              ? dom.resolutions[0]
              : dom.resolutions[1];
          return {
            id: dom.domain.name,
            attributes: {
              meta: {
                domain: dom.domain.name,
                blockchain: resolution.blockchain,
                networkId: resolution.networkId,
                owner: resolution.ownerAddress,
                registry: resolution.registry,
                resolver: resolution.resolver,
              },
              records: {},
            },
            sortingFields: {
              domain: dom.domain,
              resolution,
            },
          };
        })
        .sort((a, b) => sortFunc(a.sortingFields, b.sortingFields));
      return {
        domains: expectedData.map(({ sortingFields }) => sortingFields.domain),
        expectedData: expectedData.map(({ sortingFields, ...keep }) => keep),
      };
    }

    it('should sort by domain name ascending', async () => {
      const { domains, expectedData } = getSortedTestDomains((a, b) =>
        a.domain.name.localeCompare(b.domain.name),
      );

      const res = await supertest(api)
        .get(
          `/domains?owners[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2&sortBy=name`,
        )
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();

      expect(res.status).eq(200);
      expect(res.body.data).to.exist;
      expect(res.body.data).to.deep.equal(expectedData);
      expect(res.body.meta).to.deep.equal({
        hasMore: false,
        nextStartingAfter: domains[domains.length - 1].name,
        perPage: 100,
        sortBy: 'name',
        sortDirection: 'ASC',
      });
    });

    it('should sort by domain name descending', async () => {
      const { domains, expectedData } = getSortedTestDomains(
        (a, b) => -a.domain.name.localeCompare(b.domain.name),
      );

      const res = await supertest(api)
        .get(
          `/domains?owners[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2&sortBy=name&sortDirection=DESC`,
        )
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();

      expect(res.status).eq(200);
      expect(res.body.data).to.exist;
      expect(res.body.data).to.deep.equal(expectedData);
      expect(res.body.meta).to.deep.equal({
        hasMore: false,
        nextStartingAfter: domains[domains.length - 1].name,
        perPage: 100,
        sortBy: 'name',
        sortDirection: 'DESC',
      });
    });

    it('should sort by domain id ascending by default', async () => {
      const { domains, expectedData } = getSortedTestDomains(
        (a, b) => (a.domain.id || 0) - (b.domain.id || 0),
      );

      const res = await supertest(api)
        .get(`/domains?owners[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2`)
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();

      expect(res.status).eq(200);
      expect(res.body.data).to.exist;
      expect(res.body.data).to.deep.equal(expectedData);
      expect(res.body.meta).to.deep.equal({
        hasMore: false,
        nextStartingAfter: domains[domains.length - 1].id?.toString(),
        perPage: 100,
        sortBy: 'id',
        sortDirection: 'ASC',
      });
    });

    it('should sort by domain id descending', async () => {
      const { domains, expectedData } = getSortedTestDomains(
        (a, b) => (b.domain.id || 0) - (a.domain.id || 0),
      );

      const res = await supertest(api)
        .get(
          `/domains?owners[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2&sortBy=id&sortDirection=DESC`,
        )
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();

      expect(res.status).eq(200);
      expect(res.body.data).to.exist;
      expect(res.body.data).to.deep.equal(expectedData);
      expect(res.body.meta).to.deep.equal({
        hasMore: false,
        nextStartingAfter: domains[domains.length - 1].id?.toString(),
        perPage: 100,
        sortBy: 'id',
        sortDirection: 'DESC',
      });
    });

    it('should sort by created_at ascending', async () => {
      const { domains, expectedData } = getSortedTestDomains((a, b) => {
        const timeDiff =
          (a.domain.createdAt?.getUTCMilliseconds() || 0) -
          (b.domain.createdAt?.getUTCMilliseconds() || 0);
        const idIdff = (a.domain.id || 0) - (b.domain.id || 0);
        return timeDiff != 0 ? timeDiff : idIdff;
      });

      const res = await supertest(api)
        .get(
          `/domains?owners[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2&sortBy=created_at&sortDirection=ASC`,
        )
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();

      expect(res.status).eq(200);
      expect(res.body.data).to.exist;
      expect(res.body.data).to.deep.equal(expectedData);
      expect(res.body.meta).to.deep.equal({
        hasMore: false,
        nextStartingAfter: `${domains[
          domains.length - 1
        ].createdAt?.toISOString()}|${domains[
          domains.length - 1
        ].id?.toString()}`,
        perPage: 100,
        sortBy: 'created_at',
        sortDirection: 'ASC',
      });
    });

    it('should sort by created_at descending', async () => {
      const { domains, expectedData } = getSortedTestDomains((a, b) => {
        const timeDiff =
          (b.domain.createdAt?.getUTCMilliseconds() || 0) -
          (a.domain.createdAt?.getUTCMilliseconds() || 0);
        const idIdff = (b.domain.id || 0) - (a.domain.id || 0);
        return timeDiff != 0 ? timeDiff : idIdff;
      });

      const res = await supertest(api)
        .get(
          `/domains?owners[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2&sortBy=created_at&sortDirection=DESC`,
        )
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();

      expect(res.status).eq(200);
      expect(res.body.data).to.exist;
      expect(res.body.data).to.deep.equal(expectedData);
      expect(res.body.meta).to.deep.equal({
        hasMore: false,
        nextStartingAfter: `${domains[
          domains.length - 1
        ].createdAt?.toISOString()}|${domains[
          domains.length - 1
        ].id?.toString()}`,
        perPage: 100,
        sortBy: 'created_at',
        sortDirection: 'DESC',
      });
    });

    it('should sort with starting after', async () => {
      const { domains, expectedData } = getSortedTestDomains(
        (a, b) => -a.domain.name.localeCompare(b.domain.name),
      );

      const res = await supertest(api)
        .get(
          `/domains?owners=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2&sortBy=name&sortDirection=DESC&perPage=1&startingAfter=${domains[1].name}`,
        )
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();

      expect(res.status).eq(200);
      expect(res.body.data).to.exist;
      expect(res.body.data).to.deep.equal([expectedData[2]]);
      expect(res.body.meta).to.deep.equal({
        hasMore: true,
        nextStartingAfter: domains[2].name,
        perPage: 1,
        sortBy: 'name',
        sortDirection: 'DESC',
      });
    });

    it('should return error for invalid sortBy', async () => {
      const res = await supertest(api)
        .get(
          `/domains?owners=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2&sortBy=invalid`,
        )
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();

      expect(res.status).eq(400);
      expect(res.body).containSubset({
        errors: [
          {
            constraints: {
              isIn: 'sortBy must be one of the following values: id, name, created_at',
            },
          },
        ],
      });
    });

    it('should return error for invalid sortDirection', async () => {
      const res = await supertest(api)
        .get(
          `/domains?owners[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2&sortDirection=invalid`,
        )
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();

      expect(res.status).eq(400);
      expect(res.body).containSubset({
        errors: [
          {
            constraints: {
              isIn: 'sortDirection must be one of the following values: ASC, DESC',
            },
          },
        ],
      });
    });

    it('should return error for invalid perPage', async () => {
      const res = await supertest(api)
        .get(
          '/domains?owners[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2&perPage=0',
        )
        .auth(testApiKey.apiKey, { type: 'bearer' })
        .send();

      expect(res.status).eq(400);
      expect(res.body.code).to.exist;
      expect(res.body.message).to.exist;
      expect(res.body).to.containSubset({
        code: 'BadRequestError',
        message: "Invalid queries, check 'errors' property for more info.",
        errors: [
          {
            property: 'perPage',
            constraints: {
              min: 'perPage must not be less than 1',
            },
          },
        ],
      });
    });
  });
});
