import 'reflect-metadata';
import { createExpressServer } from 'routing-controllers';
import { DomainsController } from "./controllers/DomainsController";

const api = createExpressServer({
    classTransformer: true,
    controllers: [DomainsController],
});

export default api;