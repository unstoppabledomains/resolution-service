import * as path from 'path';
const ZnsNetwork = process.env.ZNS_NETWORK || 'mainnet';

export const env = {
  APPLICATION: {
    PORT: process.env.RESOLUTION_API_PORT || process.env.PORT || 3000,
    RUNNING_MODE: process.env.RESOLUTION_RUNNING_MODE
      ? process.env.RESOLUTION_RUNNING_MODE.split(',')
      : ['MIGRATIONS', 'LOAD_SNAPSHOT', 'API', 'CNS_WORKER', 'ZNS_WORKER'],
    ETHEREUM: {
      CNS_REGISTRY_EVENTS_STARTING_BLOCK: +(
        process.env.CNS_REGISTRY_EVENTS_STARTING_BLOCK || 9080000
      ),
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
    host: process.env.RESOLUTION_POSTGRES_HOST || 'localhost',
    username: process.env.RESOLUTION_POSTGRES_USERNAME || 'postgres',
    password: process.env.RESOLUTION_POSTGRES_PASSWORD || 'secret',
    database:
      process.env.RESOLUTION_POSTGRES_DATABASE ||
      (process.env.NODE_ENV === 'test'
        ? 'resolution_service_test'
        : 'resolution_service'),

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
