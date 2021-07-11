import BaseError from './BaseError';

export class UnsUpdaterError extends BaseError {
  constructor(message: string) {
    super(message);
  }
}
