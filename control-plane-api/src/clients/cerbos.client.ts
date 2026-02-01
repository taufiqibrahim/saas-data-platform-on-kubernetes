// @ts-expect-error no-error
import { GRPC } from '@cerbos/grpc';

export const cerbosClient = new GRPC(process.env.CERBOS_ENDPOINT ?? 'localhost:5093', {
  tls: false, // true only if you enable TLS in Cerbos
});
