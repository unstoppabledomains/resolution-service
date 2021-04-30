import { getConnectionManager, getConnection } from 'typeorm';
import { WinstonTypeormLogger } from './WinstonTypeormLogger';
import SnakeNamingStrategy from './SnakeNamingStrategy';
import { logger } from '../logger';
import { env } from '../env';

process.env.TZ = 'UTC';

const manager = getConnectionManager();
if (!manager.connections.length) {
  manager.create({
    ...env.TYPEORM,
    logger: new WinstonTypeormLogger(),
    logging: true,
    namingStrategy: new SnakeNamingStrategy(),
    // always log queries as slow
    maxQueryExecutionTime: -1,
  });
}

export default async function connect() {
  const connection = getConnection();
  if (connection.isConnected) {
    return connection;
  }

  logger.info('Initiating a TypeORM connection...');
  await connection.connect();
  logger.info('TypeORM connection established');
  return connection;
}
