import 'reflect-metadata';
import { createExpressServer } from 'routing-controllers';
import { DomainsController } from "./controllers/DomainsController";
import { StatusController } from "./controllers/StatusController";

export const api = createExpressServer({
    classTransformer: true,
    controllers: [DomainsController, StatusController],
});
