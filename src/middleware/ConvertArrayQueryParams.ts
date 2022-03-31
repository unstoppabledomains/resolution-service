import { Response, Request, NextFunction } from 'express';

export function ConvertArrayQueryParams(
  param: string,
): (request: Request, response: Response, next: NextFunction) => any {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!Array.isArray(req.query[param])) {
      const arr = req.query[param] ? [req.query[param]] : [];
      req.query[param] = arr as any; // TS gets confused by req.query[param]
    }
    next();
  };
}
