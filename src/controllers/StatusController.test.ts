import supertest from 'supertest';
import { api } from '../api';
import { expect } from 'chai';

describe('StatusController', () => {
  it('should return status json', async () => {
    const res = await supertest(api).get('/status').send();
    expect(res.body).containSubset({
      CNS: {
        latestMirroredBlock: 0,
        latestNetworkBlock: 0,
      },
      ZNS: {
        latestMirroredBlock: 0,
        latestNetworkBlock: 0,
      },
    });
    expect(res.status).eq(200);
  });
});
