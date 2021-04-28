import supertest from 'supertest';
import { api } from '../api';
import { expect } from 'chai';

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
  });
});
