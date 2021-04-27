import 'reflect-metadata';
import { createExpressServer } from 'routing-controllers';
import { DomainsController } from "./controllers/DomainsController";

export const api = createExpressServer({
    classTransformer: true,
    controllers: [DomainsController],
});
