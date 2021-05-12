import BaseError from './BaseError';

export class CnsUpdaterError extends BaseError {
  constructor(message: string) {
    super(message);
  }
}
