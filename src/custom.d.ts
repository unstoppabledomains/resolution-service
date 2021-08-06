import { Request } from 'express';
import ApiKey from './models/ApiKey';

// define req.apiKey for express request handlers by declaration merging
declare global {
  namespace Express {
    export interface Request {
      apiKey?: ApiKey;
    }
  }
}
