import BaseError from './BaseError';

export class EthUpdaterError extends BaseError {
  constructor(message: string) {
    super(message);
  }
}
