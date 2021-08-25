import { expect } from 'chai';
import sinon from 'sinon';
import { ApiKey } from '../models';
import { ApiKeyAuthMiddleware } from './ApiKeyAuthMiddleware';
import { Response, Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ForbiddenError } from 'routing-controllers';

describe('ApiKeyAuthMiddleware', () => {
  const sandbox = sinon.createSandbox();

  const middleware = new ApiKeyAuthMiddleware();

  let mockRequest: Request;
  const mockResponse: Response = {} as Response;
  let next: sinon.SinonSpy;
  let testApiKey: ApiKey;

  beforeEach(async () => {
    next = sandbox.fake();
    testApiKey = await ApiKey.createApiKey('test key');
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('calls next if correct API key is provided', async () => {
    mockRequest = {
      headers: {
        authorization: `Bearer ${testApiKey.apiKey}`,
      },
    } as Request;
    await middleware.use(mockRequest, mockResponse, next);

    expect(next.calledOnce);
  });

  it('extracts apiKey from authorization header', async () => {
    mockRequest = {
      headers: {
        authorization: `Bearer ${testApiKey.apiKey}`,
      },
    } as Request;
    await middleware.use(mockRequest, mockResponse, next);

    expect(mockRequest.apiKey).to.deep.eq(testApiKey);
  });

  it('throws error if key is invalid', async () => {
    mockRequest = {
      headers: {
        authorization: `invalidkey`,
      },
    } as Request;

    await expect(
      middleware.use(mockRequest, mockResponse, next),
    ).to.be.rejectedWith(ForbiddenError, 'Please provide a valid API key.');
  });

  it('throws error if key does not exist', async () => {
    const otherKey = uuidv4();

    mockRequest = {
      headers: {
        authorization: `Bearer ${otherKey}`,
      },
    } as Request;

    await expect(
      middleware.use(mockRequest, mockResponse, next),
    ).to.be.rejectedWith(ForbiddenError, 'Please provide a valid API key.');
  });
});
