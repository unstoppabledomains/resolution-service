import BaseError from './BaseError';

export class UnsRegistryError extends BaseError {
  constructor(message: string) {
    super(message);
  }
}
