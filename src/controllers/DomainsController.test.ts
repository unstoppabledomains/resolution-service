import supertest from 'supertest';
import { api } from '../api';
import { expect } from 'chai';
import { Domain } from '../models';
import connect from '../database/connect';

before(async () => {
  await connect();
});

describe('DomainsController', () => {
  describe('GET /domain/:domainName', () => {
    it('should return non-minted domain', async () => {
      const res = await supertest(api)
        .get('/domains/unminted-long-domain.crypto')
        .send();
      expect(res.body).containSubset({
        meta: {
          domain: 'unminted-long-domain.crypto',
          owner: null,
          resolver: null,
          location: 'UNMINTED',
        },
        records: {},
      });
      expect(res.status).eq(200);
    });

    it('should return non-minted domain when used a wrong tld', async () => {
      const res = await supertest(api).get('/domains/bobby.funnyrabbit').send();
      expect(res.status).eq(200);
      expect(res.body).containSubset({
        meta: {
          domain: 'bobby.funnyrabbit',
          owner: null,
          resolver: null,
          location: 'UNMINTED',
        },
        records: {},
      });
    });

    it('should return correct domain resolution for domain in lowercase', async () => {
      await Domain.findOrCreate({
        name: 'testdomainforcase.crypto',
        ownerAddress: '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
        node:
          '0x08c2e9d2a30aa81623fcc758848d5556696868222fbc80a15ca46ec2fe2cba4f',
        location: 'CNS',
        resolution: {
          'crypto.ETH.address': '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
        },
        resolver: '0xb66DcE2DA6afAAa98F2013446dBCB0f4B0ab2842',
      });
      const res = await supertest(api)
        .get('/domains/TESTdomainforCase.crypto')
        .send();
      expect(res.status).eq(200);
      expect(res.body).containSubset({
        meta: {
          domain: 'testdomainforcase.crypto',
          owner: '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
          resolver: '0xb66DcE2DA6afAAa98F2013446dBCB0f4B0ab2842',
          location: 'CNS',
        },
        records: {
          'crypto.ETH.address': '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
        },
      });
    });

    it('should return non-minted domain ending on .zil', async () => {
      const res = await supertest(api).get('/domains/notreal134522.zil').send();
      expect(res.status).eq(200);
      expect(res.body).containSubset({
        meta: {
          domain: 'notreal134522.zil',
          owner: null,
          resolver: null,
          location: 'UNMINTED',
        },
        records: {},
      });
    });

    it('should return minted domain ending on .zil', async () => {
      await Domain.findOrCreate({
        name: 'sometestforzil.zil',
        ownerAddress: '0xcea21f5a6afc11b3a4ef82e986d63b8b050b6910',
        resolver: '0x34bbdee3404138430c76c2d1b2d4a2d223a896df',
        node:
          '0x8052ef7b6b4eee4bc0d7014f0e216db6270bf0055bcd3582368601f2de5e60f0',
        location: 'ZNS',
        resolution: {},
      });
      const res = await supertest(api)
        .get('/domains/sometestforzil.zil')
        .send();
      expect(res.status).eq(200);
      expect(res.body).containSubset({
        meta: {
          domain: 'sometestforzil.zil',
          owner: '0xcea21f5a6afc11b3a4ef82e986d63b8b050b6910',
          resolver: '0x34bbdee3404138430c76c2d1b2d4a2d223a896df',
          location: 'ZNS',
        },
        records: {},
      });
    });

    it('should return correct domain resolution for minted .crypto domain', async () => {
      await Domain.findOrCreate({
        name: 'brad.crypto',
        ownerAddress: '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
        node:
          '0x756e4e998dbffd803c21d23b06cd855cdc7a4b57706c95964a37e24b47c10fc9',
        location: 'CNS',
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

      const res = await supertest(api).get('/domains/brad.crypto').send();

      expect(res.status).eq(200);
      expect(res.body).containSubset({
        meta: {
          domain: 'brad.crypto',
          owner: '0x8aaD44321A86b170879d7A244c1e8d360c99DdA8',
          resolver: '0xb66DcE2DA6afAAa98F2013446dBCB0f4B0ab2842',
          location: 'CNS',
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
  });

  describe('GET /domains', () => {
    it('should return empty response', async () => {
      const res = await supertest(api)
        .get('/domains?owners[]=0xC47Ef814093eCefe330604D9E81e3940ae033c9a')
        .send();
      expect(res.body).containSubset({
        data: [],
      });
      expect(res.status).eq(200);
    });
    it('should return list of test domain', async () => {
      const testDomain = Domain.create({
        name: 'test.crypto',
        node:
          '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
        ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
        location: 'CNS',
      });
      await testDomain.save();

      const res = await supertest(api)
        .get('/domains?owners[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2')
        .send();
      expect(res.body).to.deep.equal({
        data: [
          {
            id: testDomain.name,
            attributes: {
              meta: {
                domain: testDomain.name,
                location: testDomain.location,
                owner: testDomain.ownerAddress,
                resolver: null,
              },
              records: {},
            },
          },
        ],
      });
      expect(res.status).eq(200);
    });
    it('should lowercase ownerAddress', async () => {
      const testDomain = Domain.create({
        name: 'test.crypto',
        node:
          '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
        ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
        location: 'CNS',
      });
      await testDomain.save();

      const res = await supertest(api)
        .get(
          `/domains?owners[]=${'0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2'.toUpperCase()}`,
        )
        .send();
      expect(res.body).to.deep.equal({
        data: [
          {
            id: testDomain.name,
            attributes: {
              meta: {
                domain: testDomain.name,
                location: testDomain.location,
                owner: testDomain.ownerAddress,
                resolver: null,
              },
              records: {},
            },
          },
        ],
      });
      expect(res.status).eq(200);
    });
    it('should return list of test domains', async () => {
      const testDomainOne = Domain.create({
        name: 'test.crypto',
        node:
          '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
        ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
        location: 'CNS',
      });
      const testDomainTwo = Domain.create({
        name: 'test1.crypto',
        node:
          '0x99cc72a0f40d092d1b8b3fa8f2da5b7c0c6a9726679112e3827173f8b2460502',
        ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
        location: 'CNS',
      });
      await testDomainOne.save();
      await testDomainTwo.save();

      const res = await supertest(api)
        .get('/domains?owners[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2')
        .send();
      expect(res.body).to.deep.equal({
        data: [
          {
            id: testDomainOne.name,
            attributes: {
              meta: {
                domain: testDomainOne.name,
                location: testDomainOne.location,
                owner: testDomainOne.ownerAddress,
                resolver: null,
              },
              records: {},
            },
          },
          {
            id: testDomainTwo.name,
            attributes: {
              meta: {
                domain: testDomainTwo.name,
                location: testDomainTwo.location,
                owner: testDomainTwo.ownerAddress,
                resolver: null,
              },
              records: {},
            },
          },
        ],
      });
      expect(res.status).eq(200);
    });
    it('should return one domain perPage', async () => {
      const testDomainOne = Domain.create({
        name: 'test.crypto',
        node:
          '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
        ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
        location: 'CNS',
      });
      const testDomainTwo = Domain.create({
        name: 'test1.zil',
        node:
          '0xc0cfff0bacee0844926d425ce027c3d05e09afaa285661aca11c5a97639ef001',
        ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
        location: 'ZNS',
      });

      await testDomainOne.save();
      await testDomainTwo.save();

      const res = await supertest(api)
        .get(
          '/domains?owners[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2&perPage=1',
        )
        .send();
      expect(res.body).to.deep.equal({
        data: [
          {
            id: testDomainOne.name,
            attributes: {
              meta: {
                domain: testDomainOne.name,
                location: testDomainOne.location,
                owner: testDomainOne.ownerAddress,
                resolver: null,
              },
              records: {},
            },
          },
        ],
      });
      expect(res.status).eq(200);
    });
    it('should return no domain from empty page', async () => {
      const testDomainOne = Domain.create({
        name: 'test.crypto',
        node:
          '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
        ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
        location: 'CNS',
      });
      await testDomainOne.save();
      const res = await supertest(api)
        .get(
          '/domains?owners[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2&page=2',
        )
        .send();
      expect(res.body).to.deep.equal({
        data: [],
      });
      expect(res.status).eq(200);
    });
    it('should return list of test domain based on location', async () => {
      const testDomainOne = Domain.create({
        name: 'test.crypto',
        node:
          '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
        ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
        location: 'CNS',
      });
      const testDomainTwo = Domain.create({
        name: 'test1.zil',
        node:
          '0xc0cfff0bacee0844926d425ce027c3d05e09afaa285661aca11c5a97639ef001',
        ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
        location: 'ZNS',
      });

      await testDomainOne.save();
      await testDomainTwo.save();

      const res = await supertest(api)
        .get(
          '/domains?owners[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2&locations[]=CNS',
        )
        .send();
      expect(res.body).to.deep.equal({
        data: [
          {
            id: testDomainOne.name,
            attributes: {
              meta: {
                domain: testDomainOne.name,
                location: testDomainOne.location,
                owner: testDomainOne.ownerAddress,
                resolver: null,
              },
              records: {},
            },
          },
        ],
      });
      expect(res.status).eq(200);
    });
    it('should return error on missing owners param', async () => {
      const res = await supertest(api)
        .get('/domains?awef[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2')
        .send();
      expect(res.body).containSubset({
        errors: [
          {
            constraints: {
              arrayNotEmpty: 'owners should not be empty',
              isArray: 'owners must be an array',
              isNotEmpty: 'each value in owners should not be empty',
              isString: 'each value in owners must be a string',
            },
          },
        ],
      });
      expect(res.status).eq(400);
    });
    it('should return error on non array owners', async () => {
      const res = await supertest(api)
        .get('/domains?owners=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2')
        .send();
      expect(res.body).containSubset({
        message:
          'Given parameter owners is invalid. Value ("0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2") cannot be parsed into JSON.',
      });
      expect(res.status).eq(400);
    });
    it('should return error on non array locations', async () => {
      const res = await supertest(api)
        .get(
          '/domains?owners[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2&locations=we',
        )
        .send();
      expect(res.body).containSubset({
        message:
          'Given parameter locations is invalid. Value ("we") cannot be parsed into JSON.',
      });
      expect(res.status).eq(400);
    });
    it('should return error on invalid locations', async () => {
      const res = await supertest(api)
        .get(
          '/domains?owners[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2&locations[]=we',
        )
        .send();
      expect(res.body).containSubset({
        errors: [
          {
            constraints: {
              isEnum: 'each value in locations must be a valid enum value',
            },
          },
        ],
      });
      expect(res.status).eq(400);
    });
  });
  it('should return error on invalid page value', async () => {
    const res = await supertest(api)
      .get(
        '/domains?owners[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2&page=0',
      )
      .send();
    expect(res.body).containSubset({
      errors: [
        {
          constraints: {
            min: 'page must not be less than 1',
          },
        },
      ],
    });
    expect(res.status).eq(400);
  });
  it('should return error on invalid perPage', async () => {
    const res = await supertest(api)
      .get(
        '/domains?owners[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2&perPage=0',
      )
      .send();
    expect(res.body).containSubset({
      errors: [
        {
          constraints: {
            min: 'perPage must not be less than 1',
          },
        },
      ],
    });
    expect(res.status).eq(400);
  });
});
