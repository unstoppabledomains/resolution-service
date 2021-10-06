import supertest from 'supertest';
import { api } from '../api';
import { expect } from 'chai';
import { getConnection } from 'typeorm';
import { ApiKey } from '../models';

describe('ErrorHandler', () => {
  let testApiKey: ApiKey;

  beforeEach(async () => {
    testApiKey = await ApiKey.createApiKey('test key');
  });

  it('should return appropriate error for missing an owner param', async () => {
    const res = await supertest(api)
      .get('/domains/')
      .auth(testApiKey.apiKey, { type: 'bearer' })
      .send();
    expect(res.status).eq(400);
    expect(res.body).containSubset({
      code: 'BadRequestError',
      message: "Invalid queries, check 'errors' property for more info.",
      errors: [
        {
          property: 'owners',
          constraints: {
            arrayNotEmpty: 'owners should not be empty',
            isArray: 'owners must be an array',
            isNotEmpty: 'each value in owners should not be empty',
            isString: 'each value in owners must be a string',
          },
        },
      ],
    });
  });

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

  it('should return appropriate error for incorrect input', async () => {
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

  it('should return the correct validation error for incorrect networkId param', async () => {
    const res = await supertest(api)
      .get(
        '/domains?owners[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2&networkIds[]=we&blockchains[]=ETH',
      )
      .auth(testApiKey.apiKey, { type: 'bearer' })
      .send();
    expect(res.status).eq(400);
    expect(res.body.code).to.exist;
    expect(res.body.message).to.exist;
    expect(res.body).containSubset({
      code: 'BadRequestError',
      message: "Invalid queries, check 'errors' property for more info.",
      errors: [
        {
          property: 'networkIds',
          constraints: {
            isIn:
              'each value in networkIds must be one of the following values: 1, 4, 1337',
          },
        },
      ],
    });
  });

  it('should return the correct validation error for empty networkIds param', async () => {
    const res = await supertest(api)
      .get(
        '/domains?owners[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2&networkIds[]&blockchains[]=ETH',
      )
      .auth(testApiKey.apiKey, { type: 'bearer' })
      .send();
    expect(res.status).eq(400);
    expect(res.body.code).to.exist;
    expect(res.body.message).to.exist;
    expect(res.body).containSubset({
      code: 'BadRequestError',
      message: "Invalid queries, check 'errors' property for more info.",
      errors: [
        {
          property: 'networkIds',
          constraints: {
            isIn:
              'each value in networkIds must be one of the following values: 1, 4, 1337',
            isNotEmpty: 'each value in networkIds should not be empty',
          },
        },
      ],
    });
  });
  it('should return the correct validation error for empty blockchain param', async () => {
    const res = await supertest(api)
      .get(
        '/domains?owners[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2&networkIds[]=1&blockchains[]',
      )
      .auth(testApiKey.apiKey, { type: 'bearer' })
      .send();
    expect(res.status).eq(400);
    expect(res.body.code).to.exist;
    expect(res.body.message).to.exist;
    expect(res.body).containSubset({
      code: 'BadRequestError',
      message: "Invalid queries, check 'errors' property for more info.",
      errors: [
        {
          property: 'blockchains',
          constraints: {
            isIn:
              'each value in blockchains must be one of the following values: ETH, ZIL, MATIC',
            isNotEmpty: 'each value in blockchains should not be empty',
          },
        },
      ],
    });
  });
  it('should return the correct validation error for invalid blockchain param', async () => {
    const res = await supertest(api)
      .get(
        '/domains?owners[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2&networkIds[]=1&blockchains[]=BAD',
      )
      .auth(testApiKey.apiKey, { type: 'bearer' })
      .send();
    expect(res.status).eq(400);
    expect(res.body.code).to.exist;
    expect(res.body.message).to.exist;
    expect(res.body).containSubset({
      code: 'BadRequestError',
      message: "Invalid queries, check 'errors' property for more info.",
      errors: [
        {
          property: 'blockchains',
          constraints: {
            isIn:
              'each value in blockchains must be one of the following values: ETH, ZIL, MATIC',
          },
        },
      ],
    });
  });
  it('should return the correct validation error for invalid blockchain param #2', async () => {
    const res = await supertest(api)
      .get(
        '/domains?owners[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2&networkIds[]=1&blockchains[]=ETH,BAD',
      )
      .auth(testApiKey.apiKey, { type: 'bearer' })
      .send();
    expect(res.status).eq(400);
    expect(res.body.code).to.exist;
    expect(res.body.message).to.exist;
    expect(res.body).containSubset({
      code: 'BadRequestError',
      message: "Invalid queries, check 'errors' property for more info.",
      errors: [
        {
          property: 'blockchains',
          constraints: {
            isIn:
              'each value in blockchains must be one of the following values: ETH, ZIL, MATIC',
          },
        },
      ],
    });
  });
});
