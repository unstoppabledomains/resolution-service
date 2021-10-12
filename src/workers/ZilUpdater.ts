import { logger } from '../logger';
import { setIntervalAsync } from 'set-interval-async/dynamic';
import ZilWorker from './zil/ZilWorker';
import { env } from '../env';
import Bugsnag from '@bugsnag/js';

const runWorker = async (worker: ZilWorker): Promise<void> => {
  try {
    logger.info('ZilUpdater is pulling updates from Zilliqa');
    await worker.run();
  } catch (error) {
    logger.error('Failed to run the ZilWorker');
    logger.error(error);
    Bugsnag.notify(error);
  }
};

export default async (): Promise<void> => {
  const worker = new ZilWorker();
  await runWorker(worker);
  setIntervalAsync(async () => {
    await runWorker(worker);
  }, env.APPLICATION.ZILLIQA.FETCH_INTERVAL);
};
