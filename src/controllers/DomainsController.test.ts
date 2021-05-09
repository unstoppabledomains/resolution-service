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
      expect(res.body).containSubset({
        data: [{ id: testDomain.node }],
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
      console.log(res.body);
      expect(res.body).containSubset({
        data: [{ id: testDomainOne.node }, { id: testDomainTwo.node }],
      });
      expect(res.status).eq(200);
    });
  });
});
