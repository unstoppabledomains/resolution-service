import { execSync } from 'child_process';
import { logger } from '../logger';
import { env } from '../env';
import {
  CnsRegistryEvent,
  Domain,
  ZnsTransaction,
  WorkerStatus,
} from '../models';

export async function loadSnapshot(): Promise<void> {
  // Check if there is data in DB
  if (
    (await CnsRegistryEvent.count()) > 0 ||
    (await ZnsTransaction.count()) > 0 ||
    (await Domain.count()) > 9
  ) {
    logger.warn('Database is not empty, skipped snapshot loading!');
    return;
  }

  // clear domains as existing 'zil' and 'crypto' records will be conflicting
  await Domain.clear();
  await WorkerStatus.clear();

  // Execute snapshot command
  const output = execSync(
    `./tools/restore-snapshot ${env.TYPEORM.host} ${env.TYPEORM.username} ${env.TYPEORM.database}`,
    {
      stdio: 'pipe',
      env: { ...process.env, PGPASSWORD: env.TYPEORM.password },
    },
  );
  logger.info(output);

  // Check snapshot results
  if (
    (await CnsRegistryEvent.count()) !== env.TYPEORM.SNAPSHOT.cnsEventsCount ||
    (await ZnsTransaction.count()) !==
      env.TYPEORM.SNAPSHOT.znsTransactionsCount ||
    (await Domain.count()) !== env.TYPEORM.SNAPSHOT.domainsCount
  ) {
    throw new Error('Snapshot failed to load correctly.');
  }
}
