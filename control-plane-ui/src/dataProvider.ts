import { DataProvider, fetchUtils } from 'ra-core';
import { keycloakClient } from './authProvider';

const apiUrl = import.meta.env.VITE_API_URL;

/**
 * References:
 * https://github.com/marmelab/react-admin/blob/master/packages/ra-data-simple-rest/src/index.ts
 */

export const httpClient = async (url: string, options: any = {}) => {
  // Optional: refresh token if needed
  await keycloakClient.updateToken(30).catch(() => {
    console.warn('Keycloak token refresh failed');
  });

  // Convert headers to plain object
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${keycloakClient.token}`);
  options.headers = headers;

  return fetchUtils.fetchJson(url, options);
};

/**
 * Copy `uid` → `id` for a record or array of records
 */
export function mapUidToId<T extends Record<string, any>>(input: T | T[]): T | T[] {
  if (Array.isArray(input)) {
    return input.map(record => mapUidToId(record) as T);
  }

  const record = input as T;

  if ('uid' in record && !('id' in record)) {
    return { ...record, id: record.uid };
  }

  return record;
}

export const dataProvider: DataProvider = {
  // get a list of records based on sort, filter, and pagination
  getList: async (resource, params) => {
    const page = params.pagination?.page;
    const perPage = params.pagination?.perPage ?? 10;
    const filters = params.filter;
    const sort = params.sort?.field;
    const order = params.sort?.order

    const query = new URLSearchParams({
      page: String(page),
      limit: String(perPage),
    });

    // Conditionally add filter
    if (filters && Object.keys(filters).length > 0) {
      query.set("_filters", JSON.stringify(filters));
    }

    // Conditionally add sort
    if (sort && order) {
      // query.set("sort", JSON.stringify([field, order]));
      // OR (simple-rest style):
      query.set("_sort", sort);
      query.set("_order", order.toLowerCase());
    }

    const url = `${apiUrl}/${resource}?${new URLSearchParams(query).toString()}`;
    const { json } = await httpClient(url, { signal: params.signal });
    // console.log(json);

    return {
      data: mapUidToId(json.data),
      // total: parseInt(headers.get('content-range').split('/').pop(), 10),
      total: json.pagination.totalData,
      pageInfo: {
        hasNextPage: json.pagination.hasNextPage,
        hasPreviousPage: json.pagination.hasPreviousPage,

      }
    };
  },

  // get a single record by id
  getOne: async (resource, params) => {
    console.log("getOne input", resource, params)
    let query: string = '';
    if (params.meta && params.meta.embed) {
      query =
        '?' + JSON.stringify({ embed: JSON.stringify(params.meta.embed) });
    }
    const url = `${apiUrl}/${resource}/${encodeURIComponent(params.id)}${query}`;
    const { json } = await httpClient(url, { signal: params?.signal });
    const data = mapUidToId(json)
    console.log("getOne", json)
    return { data };
  },

  // get a list of records based on an array of ids
  // getMany: async () => { throw new Error('Not implemented'); },
  getMany: async (resource, params) => {
    console.log("getMany input", resource, params)
    return {
      data: []
    }
  },

  // get the records referenced to another record, e.g. comments for a post
  getManyReference: async () => { throw new Error('Not implemented'); },

  // create a record
  create: async (resource, params) => {
    console.log("create input", resource, params)
    const url = `${apiUrl}/${resource}`;
    console.log(url)
    const { json } = await httpClient(url, {
      method: 'POST',
      body: JSON.stringify(params.data),
    })
    const data = mapUidToId(json)
    console.log("Response", json)
    return {
      data
    }
  },

  // update a record based on a patch
  update: async () => { throw new Error('Not implemented'); },

  // // update a list of records based on an array of ids and a common patch
  updateMany: async () => { throw new Error('Not implemented'); },

  // // delete a record by id
  delete: async () => { throw new Error('Not implemented'); },

  // delete a list of records based on an array of ids
  deleteMany: async () => { throw new Error('Not implemented'); },
}
