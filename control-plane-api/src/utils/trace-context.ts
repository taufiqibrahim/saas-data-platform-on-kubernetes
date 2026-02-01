import { AsyncLocalStorage } from 'async_hooks';

export interface TraceContext {
  trace_id: string;
}

export const asyncLocalStorage = new AsyncLocalStorage<TraceContext>();

export function enterTraceContext(traceId: string) {
  asyncLocalStorage.enterWith({ trace_id: traceId });
}

export function getTraceId(): string | undefined {
  const store = asyncLocalStorage.getStore();
  return store?.trace_id;
}

export function getSpanId(): string | undefined {
  const store = asyncLocalStorage.getStore();
  return store?.trace_id;
}
