import { getConnectionManager, getConnection, Connection } from 'typeorm';
import { WinstonTypeormLogger } from './WinstonTypeormLogger';
import SnakeNamingStrategy from './SnakeNamingStrategy';
import { logger } from '../logger';
import { env } from '../env';
const runningMode = env.APPLICATION.RUNNING_MODE;

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
    migrationsTableName: 'typeorm_migration',
    migrationsRun: runningMode.includes('MIGRATIONS'),
  });
}

export default async function connect(): Promise<Connection> {
  console.log('URL', env.TYPEORM.url);
  const connection = getConnection();
  if (connection.isConnected) {
    return connection;
  }

  logger.info('Initiating a TypeORM connection...');
  await connection.connect();
  logger.info('TypeORM connection established');
  return connection;
}
