import * as path from 'path';

const requiredEnvNotSet = [];

if (!process.env.RESOLUTION_POSTGRES_HOST) {
  requiredEnvNotSet.push('RESOLUTION_POSTGRES_HOST');
}
if (!process.env.RESOLUTION_POSTGRES_USERNAME) {
  requiredEnvNotSet.push('RESOLUTION_POSTGRES_USERNAME');
}
if (!process.env.RESOLUTION_POSTGRES_PASSWORD) {
  requiredEnvNotSet.push('RESOLUTION_POSTGRES_PASSWORD');
}
if (!process.env.RESOLUTION_POSTGRES_DATABASE) {
  requiredEnvNotSet.push('RESOLUTION_POSTGRES_DATABASE');
}
if (!process.env.VIEWBLOCK_API_KEY) {
  requiredEnvNotSet.push('VIEWBLOCK_API_KEY');
}
if (!process.env.ETHEREUM_JSON_RPC_API_URL) {
  requiredEnvNotSet.push('ETHEREUM_JSON_RPC_API_URL');
}

if (requiredEnvNotSet.length !== 0) {
  throw new Error(
    `Environment variables are not defined: ${requiredEnvNotSet.join(' && ')}`,
  );
}

const ZnsNetwork = process.env.ZNS_NETWORK || 'mainnet';

export const env = {
  APPLICATION: {
    PORT: process.env.RESOLUTION_API_PORT || process.env.PORT || 3000,
    RUNNING_MODE: process.env.RESOLUTION_RUNNING_MODE
      ? process.env.RESOLUTION_RUNNING_MODE.split(',')
      : ['MIGRATIONS', 'LOAD_SNAPSHOT', 'API', 'CNS_WORKER', 'ZNS_WORKER'],
    ETHEREUM: {
      CNS_REGISTRY_EVENTS_STARTING_BLOCK: Number(
        process.env.CNS_REGISTRY_EVENTS_STARTING_BLOCK || 9080000,
      ),
      JSON_RPC_API_URL: process.env.ETHEREUM_JSON_RPC_API_URL,
      CHAIN_ID: Number(process.env.ETHEREUM_CHAIN_ID || 1),
      CNS_CONFIRMATION_BLOCKS: Number(process.env.CNS_CONFIRMATION_BLOCKS || 3),
      CNS_BLOCK_FETCH_LIMIT: Number(process.env.CNS_BLOCK_FETCH_LIMIT || 1000),
      CNS_RESOLVER_ADVANCED_EVENTS_STARTING_BLOCK: Number(
        process.env.CNS_RESOLVER_ADVANCED_EVENTS_STARTING_BLOCK || 9080000,
      ),
      CNS_RESOLVER_RECORDS_PER_PAGE: Number(
        process.env.CNS_RECORDS_PER_PAGE || 100,
      ),
      CNS_FETCH_INTERVAL: Number(process.env.CNS_FETCH_INTERVAL || 5000),
    },
    ZILLIQA: {
      NETWORK: ZnsNetwork,
      ZNS_REGISTRY_CONTRACT:
        ZnsNetwork === 'mainnet'
          ? '0x9611c53be6d1b32058b2747bdececed7e1216793'
          : '0xB925adD1d5EaF13f40efD43451bF97A22aB3d727',
      JSON_RPC_API_URL:
        ZnsNetwork === 'mainnet'
          ? 'https://api.zilliqa.com/'
          : 'https://dev-api.zilliqa.com/',
      VIEWBLOCK_API_KEY: process.env.VIEWBLOCK_API_KEY,
      VIEWBLOCK_API_URL: 'https://api.viewblock.io/v1/zilliqa',
      FETCH_INTERVAL: Number(process.env.ZNS_FETCH_INTERVAL || 5000),
    },
    NEW_RELIC_LICENSE_KEY: process.env.NEW_RELIC_LICENSE_KEY || '',
    NEW_RELIC_APP_NAME: process.env.NEW_RELIC_APP_NAME || '',
    BUGSNAG_API_KEY: process.env.BUGSNAG_API_KEY || '',
  },
  TYPEORM: {
    LOGGING: {
      colorize: process.env.TYPEORM_LOGGING_COLORIZE || true,
    },
    type: 'postgres' as const,
    host: process.env.RESOLUTION_POSTGRES_HOST,
    username: process.env.RESOLUTION_POSTGRES_USERNAME,
    password: process.env.RESOLUTION_POSTGRES_PASSWORD,
    database: process.env.RESOLUTION_POSTGRES_DATABASE,
    entities: [
      path.join(__dirname, './models/index.ts'),
      path.join(__dirname, './models/index.js'),
    ] as string[],
    migrations: [
      path.join(__dirname, './database/migrations/*.ts'),
      path.join(__dirname, './database/migrations/*.js'),
    ] as string[],
  },
};
