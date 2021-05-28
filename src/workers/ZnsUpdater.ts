import { logger } from '../logger';
import { setIntervalAsync } from 'set-interval-async/dynamic';
import ZnsWorker from './zns/ZnsWorker';
import { env } from '../env';
import Bugsnag from '@bugsnag/js';

let worker: ZnsWorker;

const runWorker = async (): Promise<void> => {
  if (!env.APPLICATION.RUNNING_MODE.includes('ZNS_WORKER')) {
    return;
  }

  if (!worker) {
    worker = new ZnsWorker();
  }

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
  await runWorker();
  setIntervalAsync(async () => {
    await runWorker();
  }, env.APPLICATION.ZILLIQA.FETCH_INTERVAL);
};
