import BaseError from './BaseError';

export class CnsResolverError extends BaseError {
  constructor(message: string) {
    super(message);
  }
}
