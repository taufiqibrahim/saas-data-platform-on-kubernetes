import { NextFunction, Request, Response } from 'express';
import { ValidateError } from 'tsoa';

import { HttpError } from '@/types/errors';

// This is the global error handler
// @ts-expect-error next unused but required
export function errorHandler(err: HttpError, req: Request, res: Response, next: NextFunction) {
  // `req.log` comes from pino-http, already has traceId bound
  try {
    req.log.error({ err }, 'Request failed');
  } catch (error) {}

  // TSOA validation errors
  if (err instanceof ValidateError) {
    return res.status(400).json({
      message: 'Validation Failed',
      details: err?.fields, // includes which fields failed
    });
  }

  // Custom HttpError from application code
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      message: err.message,
      // FIX: include the `detail` property so structured errors are returned
      ...(err.detail ? err.detail : {}),
    });
  }

  // Fallback to generic 500
  return res.status(500).json({
    error: 'Internal Server Error',
    traceId: req.id, // send traceId back if you want clients to report it
  });
}
