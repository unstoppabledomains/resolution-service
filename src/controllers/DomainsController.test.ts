import supertest from 'supertest';
import api from '../api';
import { expect } from 'chai';

describe('DomainsController', () => {
    it('should return non-minted domain', async () => {
        const res = await supertest(api).get('/domains/unminted-long-domain.crypto').send();
        console.log(res.body);
        expect(res.body).containSubset({
            meta: {
                domain: 'unminted-long-domain.crypto',
                owner: null,
                resolver: null,
                location: 'UNMINTED'
            },
            records: {}
        });
        expect(res.status).eq(200);
    })
})