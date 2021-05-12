/* eslint-disable @typescript-eslint/no-var-requires */
require('ts-node').register();
const updater = require('./CnsUpdater');

updater.startWorker();
