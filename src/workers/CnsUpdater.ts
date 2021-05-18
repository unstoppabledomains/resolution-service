import { logger } from '../logger';
import { setIntervalAsync } from 'set-interval-async/dynamic';

export default (): void => {
  setIntervalAsync(async () => {
    // todo Cns polling logic is here
    logger.info('CnsUpdater is pulling updates from Ethereum');
  }, 5000); // todo adjust intervals up to 10 minutes
};
