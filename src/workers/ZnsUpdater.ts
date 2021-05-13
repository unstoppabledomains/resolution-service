import { logger } from '../logger';
import { setIntervalAsync } from 'set-interval-async/dynamic';
import connect from '../database/connect';
import ZnsWorker from './Zns/ZnsWorker';

const worker = new ZnsWorker({ perPage: 25 });

setIntervalAsync(async () => {
  // todo Zns polling logic is here
  const connection = await connect();
  logger.info('ZnsUpdater is pulling updates from Zilliqa');
  await worker.run();
  await connection.close();
}, 5000); // todo adjust intervals up to 10 minutes
