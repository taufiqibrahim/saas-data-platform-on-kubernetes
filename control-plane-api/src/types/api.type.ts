export type BaseResponse<T> = {
  code: string;
  message?: string;
  errors: string | null;
  data?: T;
  serverTime: string;
  spanID?: string;
  traceID?: string;
};

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalData: number;
  limit: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationInfo;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface IRecordOfAny {
  [key: string]: any;
}

export type AnyJSONValue =
  | string
  | number
  | boolean
  | null
  | AnyJSONValue[]
  | { [key: string]: AnyJSONValue };

export type AnyJSONObject = { [key: string]: AnyJSONValue };
