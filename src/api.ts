import 'reflect-metadata';
import {
  createExpressServer,
  getMetadataArgsStorage,
} from 'routing-controllers';
import { DomainsController } from './controllers/DomainsController';
import { StatusController } from './controllers/StatusController';
import swaggerUI from 'swagger-ui-express';
import { validationMetadatasToSchemas } from 'class-validator-jsonschema';
import { routingControllersToSpec } from 'routing-controllers-openapi';
import Bugsnag from '@bugsnag/js';
import BugsnagPluginExpress from '@bugsnag/plugin-express';
import { env } from './env';
import ErrorHandler from './errors/ErrorHandler';

export const api = createExpressServer({
  classTransformer: true,
  defaultErrorHandler: false,
  controllers: [DomainsController, StatusController],
  middlewares: [ErrorHandler],
});

if (env.APPLICATION.BUGSNAG_API_KEY) {
  Bugsnag.start({
    apiKey: env.APPLICATION.BUGSNAG_API_KEY,
    plugins: [BugsnagPluginExpress],
  });
  const bugsnagPlugin = Bugsnag.getPlugin('express');
  api.use(bugsnagPlugin?.requestHandler);
  api.use(bugsnagPlugin?.errorHandler);
}

const schemas = validationMetadatasToSchemas({
  refPointerPrefix: '#/components/schemas/',
});
const storage = getMetadataArgsStorage();
const swaggerSpec = routingControllersToSpec(
  storage,
  {},
  {
    components: { schemas },
  },
);

api.use('/api-docs', swaggerUI.serve, swaggerUI.setup(swaggerSpec));
