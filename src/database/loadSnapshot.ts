import { execSync } from 'child_process';
import { logger } from '../logger';
import { env } from '../env';
import { CnsRegistryEvent, Domain, ZnsTransaction } from '../models';

export async function loadSnapshot(): Promise<void> {
  // Check if there is data in DB
  if ((await CnsRegistryEvent.count()) > 0 || (await ZnsTransaction.count()) > 0 || (await Domain.count()) > 2) {
    logger.warn("Database is not empty, skipped snapshot loading!");
    return;
  }

  // clear domains as existing 'zil' and 'crypto' records will be conflicting
  await Domain.clear(); 

  // Execute snapshot command
  let output = execSync(`./tools/restore-snapshot ${env.TYPEORM.host} ${env.TYPEORM.username} ${env.TYPEORM.database}`, {stdio : 'pipe', env: {...process.env, "PGPASSWORD": env.TYPEORM.password}});
  logger.info(output);
}
