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
import('newrelic');

export const api = createExpressServer({
  classTransformer: true,
  controllers: [DomainsController, StatusController],
});

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
