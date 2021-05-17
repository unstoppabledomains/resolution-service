import { logger } from '../logger';
import { setIntervalAsync } from 'set-interval-async/dynamic';
import connect from '../database/connect';
import ZnsWorker from './Zns/ZnsWorker';
import { Domain } from '../models';
import { znsNamehash } from '../utils/namehash';

const worker = new ZnsWorker();

setIntervalAsync(async () => {
  logger.info('ZnsUpdater is pulling updates from Zilliqa');
  const connection = await connect();
  // check if the root domain exists in db, otherwise create it
  const root = await Domain.findOne({ name: 'zil' });
  if (!root) {
    await new Domain({
      name: 'zil',
      node: znsNamehash('zil'),
      location: 'ZNS',
    }).save();
  }

  await worker.run();
  await connection.close();
}, 5000); // todo adjust intervals up to 10 minutes
