import { logger } from '../logger';
import { setIntervalAsync } from 'set-interval-async/dynamic';
import ZnsWorker from './zns/ZnsWorker';
import { env } from '../env';

const worker = new ZnsWorker();

const runWorker = async () => {
  logger.info('ZnsUpdater is pulling updates from Zilliqa');
  await worker.run();
};

export default async (): Promise<void> => {
  try {
    await runWorker();
    setIntervalAsync(runWorker, env.APPLICATION.ZILLIQA.FETCH_INTERVAL);
  } catch (error) {
    logger.error('Failed to run the ZnsWorker');
    logger.error(error);
  }
};
