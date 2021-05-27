# Resolution service

![CI](https://github.com/unstoppabledomains/resolution-service/actions/workflows/node.js.yml/badge.svg?branch=master)
[![Unstoppable Domains Documentation](https://img.shields.io/badge/Documentation-unstoppabledomains.com-blue)](https://docs.unstoppabledomains.com/)
[![Get help on Discord](https://img.shields.io/badge/Get%20help%20on-Discord-blueviolet)](https://discord.gg/b6ZVxSZ9Hn)

 - [Installation](README.md#installation)
   - [Pre-requirements](README.md#pre-requirements)
   - [Quick start](README.md#quick-start)
 - [Running the service](README.md#running-the-service)
   - [Environment configuration options](README.md#environment-configuration-options)
   - [Running modes](README.md#running-modes)
   - [API reference](README.md#api-reference)
 - [Development notes](README.md#development-notes)

Resolution service provides an API for getting domain data and metadata regardless of that domain's location (whether it is stored in Ethereum, Zilliqa, or any other blockchain). The service is used to cache blockchain events in a database for easy retrieval without acessing blockchain APIs.

The resolution service is provided as a docker image so it can be launched on a variety of platforms and in the cloud.

## Installation
### Pre-requirements
 - **git** - to clone the repository.
 - **docker** - to run the service.
 Install docker by following [instructions](https://docs.docker.com/engine/install/) for an appropriate system.
 - **postgres** - to store the data.
 Postgres can be configured on the same server as the resolution service or on a dedicated database hosting (e.g. AWS RDS, Google Cloud SQL). To install postgres locally, follow these [instructions](https://www.postgresql.org/download). Make sure to configure password authentication for the DB user that will be used by the service.

### Quick start
1. Clone the resolution-service repository\
`git clone https://github.com/unstoppabledomains/resolution-service.git`
2. Build the docker container\
`docker build -t resolution-service .`
3. Setup environment variables\
Create a file `service.env` that will contain required environment variables:  
```
NODE_ENV=production
RESOLUTION_POSTGRES_HOST=example.com:5432   # DB host
RESOLUTION_POSTGRES_USERNAME=example        # DB user configured in postgres
RESOLUTION_POSTGRES_PASSWORD=password       # DB password configured in postgres
ETHEREUM_JSON_RPC_API_URL=https://infura.io # Address of a JSON RPC provider. This can be a public API (e.g. infura), or a local ethereum node with JSON RPC enabled
VIEWBLOCK_API_KEY=apikey                    # key for Viewblock API, required for getting data from Zilliqa blockchain
```
This is the minimum required set of configurations for the service. Additional configuration options are listed in [Environment configuration options](README.md#environment-configuration-options).

4. Setup postgres database.
   - Connect to a postgres instance using the psql console\
`psql --host=HOSTNAME --username=USERNAME`
   - Create the `resolution_service` database\
`createdb resolution_service`
5. Launch the service\
`docker run -d --env-file service.env -p 3000:3000 --network="host" resolution-service`

> ℹ️ By default, the service will use a snapshot of a synchronized database to seed domain data. If you want to synchronize blockchain data from scratch, add `RUNNING_MODE=API,CNS_WORKER,ZNS_WORKER,MIGRATIONS` to the `service.env` file.

## Running the service

Once the service is started, it will perform initial synchronization with the blockchain networks. It may take more than 24 hours for a full synchronization. To speed up the process, a snapshot of the database is provided by Unstoppable domains: [TBD](snapshot-file-location). The snapshot is loaded by default using the `LOAD_SNAPSHOT` running mode (see [Running modes](README.md#running-modes)).
During the initial synchronization the API may not work reliably. The status of synchronization can be checked using the `/status` endpoint. After the synchronization is complete, the service API endpoints can be accessed normally. 
Note that the service is stateless, so the container doesn't need any persistent storage. All data is stored in the database.

### Environment configuration options
Option | Default value | required | Description
-------|---------------|----------|------------
RESOLUTION_API_PORT | 3000 | :x:	| The port for the HTTP API.
RESOLUTION_RUNNING_MODE | API,CNS_WORKER, ZNS_WORKER,MIGRATIONS, LOAD_SNAPSHOT | :x:	| Comma-separated list of running modes of the resolution service (see [Running modes](README.md#running-modes)).
RESOLUTION_POSTGRES_HOST | localhost | :heavy_check_mark:	| Host for the postgres DB. Note that to connect to a postgres instance running on the same server as the container, `host.docker.internal` should be used instead of `localhost` on Windows and MacOS (see https://docs.docker.com/docker-for-windows/networking/#use-cases-and-workarounds).
RESOLUTION_POSTGRES_USERNAME | postgres | :heavy_check_mark:	| Username that is used to connect to postgres.
RESOLUTION_POSTGRES_PASSWORD | secret | :heavy_check_mark:	| Password that is used to connect to postgres.
RESOLUTION_POSTGRES_DATABASE | resolution_service | :x:	| Database name in postgres.
CNS_CONFIRMATION_BLOCKS | 3 | :x:	| Number of blocks that the service will wait before accepting an event from the CNS contract. This helps to avoid block reorgs, forks, etc.
CNS_BLOCK_FETCH_LIMIT | 1000 | :x:	| Batch limit for fetching event data from the Ethereum JSON RPC. Note that some API providers may limit the amount of data that can be returned in a single request. So this number should be kept relatively low. However, raising this limit should speed up synchronization if a dedicated node is used with the service.
CNS_RECORDS_PER_PAGE | 100 | :x:	| Batch limit for fetching domain records from CNS registry smart contract.
CNS_FETCH_INTERVAL | 5000 | :x:	| Specifies the interval to fetch data from the CNS registry in milliseconds.
CNS_REGISTRY_EVENTS_STARTING_BLOCK | 9080000 | :x:	| Starting block that is used to look for events in the CNS registry. This helps to avoid parsing old blockchain data, before the contract was even deployed.
CNS_RESOLVER_ADVANCED_EVENTS_STARTING_BLOCK | 9080000 | :x:	| Starting block that is used to look for events in the CNS registry.
ETHEREUM_JSON_RPC_API_URL | - | :heavy_check_mark:	| Address of a JSON RPC provider. This can be a public API (e.g. infura), or a local ethereum node with JSON RPC enabled.
ETHEREUM_CHAIN_ID | 1 | :x:	| ID of the Ethereum chain that is used by the service.
ZNS_NETWORK | mainnet | :x:	| Name of the Zilliqa network will be used by ZNS worker (mainnet or testnet).
VIEWBLOCK_API_KEY | - | :heavy_check_mark:	| API key for [viewblock](https://viewblock.io/api), required by ZNS worker.
ZNS_FETCH_INTERVAL | 5000 | :x:	| Specifies the interval to fetch data from the ZNS registry in milliseconds.
NEW_RELIC_LICENSE_KEY | - | :x:	| License key that will be used to access newrelic. If the key is not specified, new relic will not be enabled.
NEW_RELIC_APP_NAME | - | :x:	| App name will be used to access newrelic. If the app name is not specified, new relic will not be enabled.
BUGSNAG_API_KEY | - | :x:	| API key that will be used to access bugsnag. If the key is not specified, bugsnag will not be enabled.
TYPEORM_LOGGING_COLORIZE | true | :x:	| Colorize typeorm logs.

### Running modes
The service provides several running modes. By default it will run all of them. However, the modes that will be used can be selected during startup using the RESOLUTION_RUNNING_MODE environment variable.
Available running modes:
 - **API** - Runs the service API.
 - **CNS_WORKER** - Runs the CNS worker to sync data from the Ethereum CNS registry
 - **ZNS_WORKER** - Runs the ZNS worker to sync data from the Zilliqa ZNS registry
 - **MIGRATIONS** - Runs the migration scripts if necessary.
 - **LOAD_SNAPSHOT** - Loads the snapshot data from `/resolution_service.dump`

For example, to run only the `API` with the `CNS_WORKER`, the following environment configuration can be used:

```
RESOLUTION_RUNNING_MODE=API,CNS_WORKER
```

## API reference

The full api reference can be found [here](link-to-openapi-spec)

Endpoint | Description
---------|------------
GET /domains | Gets the list of domains.
GET /domains/:domainName | Gets the resolution of the specified domain.
GET /status | Gets the synchronization status.
GET /api-docs | Returns a swagger documentation page.

## Development notes
### Development pre-requirements
The dev. environment has generally the same pre-requirements as running the service normally. So, postgres and docker are also necessary.
For convenience postgres configuration can be the same as defaults (username - postgres, password - secret).

Additional pre-requirements that are necessary for development:
 - Node.JS 14.16.1\
 Can be installed using [NVM](https://github.com/nvm-sh/nvm)
 - [yarn](https://yarnpkg.com/lang/en/docs/install)

### Running in dev. mode
1. Install project dependencies
```
nvm use 14.16.1 
yarn install
```
2. Configure environment variables.\
The required variables are the same as running the service in docker.
```
RESOLUTION_POSTGRES_HOST=localhost
RESOLUTION_POSTGRES_USERNAME=postgres
RESOLUTION_POSTGRES_PASSWORD=password
ETHEREUM_JSON_RPC_API_URL=localhost
```
3. Run the service
```
yarn start:dev
```

### Running unit tests
Unit tests can be run using `yarn test`. For checking coverage use `yarn test:coverage`.

Unit/integration tests use a postgres database that is cleaned before each test. By default, the database name is `resolution_service_test`.

The tests also use an Ethereum node to test interaction with smart contracts. By default ganache is used. But geth in dev mode is also available. There are several commands available to start an ethereum node: 
 - `yarn ethereum:docker:start` - starts a `geth` node in docker.
 - `yarn ethereum:docker:stop` - stops a `geth` node that was launched previously.
 - `yarn ethereum:ganache:start` - starts `ganache-cli` in the background. The command outputs PID of the started ganache process so it can be killed later.

### Service architecture

![Architecture chart](doc/ResolutionService.png)

The service currently consists of three main components: API, and two workers.
The API component is a basic HTTP API that allows reading domain data from the database. The OpenAPI specification can be found [here](link-to-openapi-spec).

Currently there are two workers in the resolution service:
 - CNS worker\
Contains a scheduled job that connects to the Ethereum blockchain using JSON RPC and pulls CNS (.crypto) domains and resolution events. The events are parsed and saved to the database. 
 - ZNS worker\
Contains a scheduled job that connects to the Zilliqa blockchain using and pulls ZNS (.zil) domains and resolution events. The events are parsed and saved to the database. 

More workers may be added in the future.

### Logs and monitoring

The resolution service outputs logs to `stdout` so they are available by `docker logs` and can be monitored by cloud tools (e.g. AWS CloudWatch or Google Cloud Logging). The general log format should be:
`<timestamp> <log level>: <Component label> - <Log message>`

The resolution service has a configurable logging level. Log messages are at consistent levels across the whole service. We use the following guidelines to determine logging level:
Event|Component|description|log level
-----|---------|-----------|---------
Startup info|all|Log any startup information (e.g. worker is starting, API is listening)|info
Sync progress|Workers|Log current sync progress of a worker (which blocks are being processed, how many blocks are left to process)|info
Handled errors|all|Log any errors that can be handled gracefully (e.g. a malformed request that will return a 400 error)|warn
Unhandled errors|all|Log any errors that were captured by top-level error handlers (e.g. an unexpected third-party API error, invalid db state)|error
API Request|API controllers|Log any request to the API with their parameters|debug
DB query|all|Log any db queries with their parameters|debug
Parsed event|Workers|Log any event or transaction parsed by the worker|debug
External API calls|all|Log external API calls|debug

Additionally, if the appropriate keys are provided in the environment configuration, the service will report errors to monitoring tools. The resolution service has integrations with [bugsnag](https://www.bugsnag.com/) and [newrelic](https://newrelic.com/). 
