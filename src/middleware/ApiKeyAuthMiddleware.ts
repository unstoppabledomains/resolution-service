import {
  Middleware,
  ExpressMiddlewareInterface,
  ForbiddenError,
} from 'routing-controllers';
import { Response, Request, NextFunction } from 'express';
import { ApiKey } from '../models';

@Middleware({ type: 'before' })
export class ApiKeyAuthMiddleware implements ExpressMiddlewareInterface {
  static BearerUuidRegex =
    /^Bearer ([0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12})$/i;

  async use(req: Request, res: Response, next: NextFunction) {
    const providedKey = req.headers.authorization?.match(
      ApiKeyAuthMiddleware.BearerUuidRegex,
    );
    if (providedKey) {
      const apiKey = await ApiKey.queryApiKey(providedKey[1]);
      if (apiKey !== undefined) {
        req.apiKey = apiKey;
        return next();
      }
    }

    throw new ForbiddenError('Please provide a valid API key.');
  }
}
