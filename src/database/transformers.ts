import { ValueTransformer } from 'typeorm';

export const lowercaseTransformer: ValueTransformer = {
  to: (entityValue: string) => {
    return entityValue.toLowerCase();
  },
  from: (databaseValue: string) => {
    return databaseValue;
  },
};
