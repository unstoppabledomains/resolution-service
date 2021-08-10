import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiSubset from 'chai-subset';
import 'chai/register-expect';
import connect from './database/connect';
import { getConnection } from 'typeorm';
import fixtures from './fixtures';
import nock from 'nock';
import sinonChai from 'sinon-chai';
import { logger } from './logger';

chai.use(chaiSubset);
chai.use(chaiAsPromised);
chai.use(sinonChai);
// disallow any 3-rd party http connections except localhost and google storage
nock.disableNetConnect();
nock.enableNetConnect((host) => {
  return (
    host.includes('127.0.0.1') ||
    host.includes('localhost') ||
    host.includes('storage.googleapis.com')
  );
});

if (process.env.NODE_ENV !== 'test') {
  throw new Error('NODE_ENV set to ' + process.env.NODE_ENV);
}
export const mochaHooks = {
  async beforeAll(): Promise<void> {
    logger.transports.forEach((transport) => (transport.silent = true));
    await connect();
    // Why does following line think there are pending migrations?
    // if (await getConnection().showMigrations()) {
    //   throw new Error('Have a pending migrations');
    // }
  },
  async beforeEach(): Promise<void> {
    const tableNames = getConnection().entityMetadatas.map((v) => v.tableName);
    await getConnection().query(
      tableNames
        .map((tableName) => `ALTER TABLE ${tableName} DISABLE TRIGGER ALL;`)
        .join('') +
        tableNames.map((tableName) => `DELETE FROM ${tableName};`).join('') +
        tableNames
          .map((tableName) => `ALTER TABLE ${tableName} ENABLE TRIGGER ALL;`)
          .join(''),
    );
    await fixtures();
    nock.cleanAll();
  },
  async afterAll(): Promise<void> {
    return getConnection().close();
  },
};
