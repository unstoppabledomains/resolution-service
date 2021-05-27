import { logger } from '../logger';
import { setIntervalAsync } from 'set-interval-async/dynamic';
import ZnsWorker from './zns/ZnsWorker';
import { env } from '../env';
import Bugsnag from '@bugsnag/js';

const runWorker = async (worker: ZnsWorker): Promise<void> => {
  try {
    logger.info('ZnsUpdater is pulling updates from Zilliqa');
    await worker.run();
  } catch (error) {
    Bugsnag.notify(error);
    logger.error('Failed to run the ZnsWorker');
    logger.error(error);
  }
};

export default async (): Promise<void> => {
  const worker = new ZnsWorker();
  await runWorker(worker);
  setIntervalAsync(async () => {
    await runWorker(worker);
  }, env.APPLICATION.ZILLIQA.FETCH_INTERVAL);
};
