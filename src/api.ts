import 'reflect-metadata';
import {
  createExpressServer,
  getMetadataArgsStorage,
} from 'routing-controllers';
import { DomainsController } from './controllers/DomainsController';
import { StatusController } from './controllers/StatusController';
import { MetaDataController } from './controllers/MetaDataController';
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
  cors: true,
  controllers: [DomainsController, StatusController, MetaDataController],
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
    components: {
      schemas,
      securitySchemes: {
        apiKeyAuth: {
          scheme: 'bearer',
          type: 'http',
        },
      },
    },
  },
);

// There's no way to set a custom attribute for a specific parameter in routing-controllers-openapi
// We could add a custom decorator for attributes in the future if we need to set more attributes
// But it's easier to just hard-code it for now
swaggerSpec.paths['/domains'].get.parameters[0].style = 'deepObject';

const options = {
  swaggerOptions: {
    url: '/api-docs/swagger.json',
  },
};

api.get('/api-docs/swagger.json', (_req: any, res: any) =>
  res.json(swaggerSpec),
);
api.use(
  '/api-docs',
  swaggerUI.serveFiles(undefined, options),
  swaggerUI.setup(undefined, options),
);
