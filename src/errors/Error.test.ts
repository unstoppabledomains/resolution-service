import supertest from 'supertest';
import { api } from '../api';
import { expect } from 'chai';
import { getConnection } from 'typeorm';

describe('ErrorHandler', () => {
  it('should return appropriate error for missing an owner param', async () => {
    const res = await supertest(api).get('/domains/').send();
    expect(res.status).eq(400);
    expect(res.body).containSubset({
      code: "BadRequestError",
      message: "Invalid queries, check 'errors' property for more info.",
      errors: [
        {
          property: 'owners',
          constraints: {
            arrayNotEmpty: "owners should not be empty",
            isArray: "owners must be an array",
            isNotEmpty: "each value in owners should not be empty",
            isString: "each value in owners must be a string"
          }
        }
      ]
    });
  });

  it('should format the 500 error', async () => {
    const connection = getConnection();
    connection.close();
    const res = await supertest(api)
      .get('/domains/brad.crypto')
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
      .get('/domains?owners[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2&perPage=0')
      .send();

    expect(res.status).eq(400);
    expect(res.body.code).to.exist;
    expect(res.body.message).to.exist;
    expect(res.body).to.containSubset({
      code: "BadRequestError",
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

  it('should return the correct validation error for incorrect location param', async () => {
    const res = await supertest(api)
      .get('/domains?owners[]=0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2&locations[]=we')
      .send();
    expect(res.status).eq(400);
    expect(res.body.code).to.exist;
    expect(res.body.message).to.exist;
    expect(res.body).containSubset({
      code: "BadRequestError",
      message: "Invalid queries, check 'errors' property for more info.",
      errors: [
        {
          property: 'locations',
          constraints: {
            isEnum: 'each value in locations must be a valid enum value',
          },
        },
      ],
    });
  });
});
