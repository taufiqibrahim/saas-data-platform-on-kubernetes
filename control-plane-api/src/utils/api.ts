import crypto from 'crypto';
import dayjs from 'dayjs';

import { BaseResponse } from '../types/api.type';

function isSystemRole(principal: { roles?: string[] }): boolean {
  return Array.isArray(principal.roles) && principal.roles.includes('SystemRole');
}

function generateRequestId(): string {
  return crypto.randomUUID();
}

function generateTraceId(): string {
  return crypto.randomBytes(16).toString('hex');
}

function generateSpanId(): string {
  return crypto.randomBytes(8).toString('hex');
}

function createResponse<T>(
  code: string,
  serverTime: Date,
  message?: string,
  errors?: string | null,
  data?: T,
): BaseResponse<T> {
  const formattedTime = dayjs(serverTime).format('YYYY-MM-DDTHH:mm:ss.SSSSSS');

  return {
    code: code,
    message: message,
    errors: errors || null,
    data: data,
    serverTime: formattedTime,
  };
}

function validateRequiredFields<T extends Record<string, any>>(
  input: T,
  fields: (keyof T)[],
): string[] {
  return fields.filter((field) => !input[field]).map((field) => String(field));
}

function createErrorResponse<T>(
  err: (Error & { status?: number; details?: any }) | string,
  data?: T,
): BaseResponse<T> & { statusCode: number } {
  if (typeof err === 'string') {
    return {
      ...createResponse('FAILURE', new Date(), err, undefined, data),
      statusCode: 500,
    };
  }

  return {
    ...createResponse(
      'FAILURE',
      new Date(),
      err.message || 'A server error occurred',
      err.details,
      data,
    ),
    statusCode: err.status || 500,
  };
}

function createSuccessResponse<T>(data?: T): BaseResponse<T> {
  return createResponse('SUCCESS', new Date(), 'Success', undefined, sanitizeForJson(data));
}

function sanitizeForJson(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForJson);
  }

  if (obj && typeof obj === 'object') {
    if (obj instanceof Date) {
      return obj.toISOString();
    }

    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'bigint') {
        result[key] = value.toString();
      } else {
        result[key] = sanitizeForJson(value);
      }
    }
    return result;
  }

  return obj;
}

function offsetPagination(page: number, limit: number) {
  return page && limit ? (page - 1) * limit : undefined;
}

export {
  createErrorResponse,
  createResponse,
  createSuccessResponse,
  generateRequestId,
  generateSpanId,
  generateTraceId,
  isSystemRole,
  offsetPagination,
  sanitizeForJson,
  validateRequiredFields,
};
