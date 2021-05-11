import supertest from 'supertest';
import { api } from '../api';
import { expect } from 'chai';
import { Domain } from '../models';

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
