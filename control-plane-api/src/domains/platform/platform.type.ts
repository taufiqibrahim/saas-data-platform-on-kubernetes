import { PaginationOptions } from '@/types/api.type';

import { PaginationInfo } from '../_shared/shared.type';

export interface PlatformProviderRegionResponse {
  /**
   * Unique ID
   * @example "83ef9fc3-159c-43fc-a31f-0d4575dc373c"
   */
  uid: string;
  /**
   * Region name
   * @example "ap-southeast-1"
   */
  name: string;
  /**
   * Region display name
   * @example "Singapore"
   */
  displayName: string;
}

export interface PlatformProviderResponse {
  /**
   * Unique ID
   * @example "83ef9fc3-159c-43fc-a31f-0d4575dc373c"
   */
  uid: string;
  /**
   * Platform provider name
   * @example "AWS_EKS"
   */
  name: string;
  /**
   * Platform provider display name
   * @example "Amazon Elastic Kubernetes Service (EKS)"
   */
  displayName: string;
}

export interface PlatformProviderWithRegionsResponse {
  /**
   * Unique ID
   * @example "83ef9fc3-159c-43fc-a31f-0d4575dc373c"
   */
  uid: string;
  /**
   * Platform provider name
   * @example "AWS_EKS"
   */
  name: string;
  /**
   * Platform provider display name
   * @example "Amazon Elastic Kubernetes Service (EKS)"
   */
  displayName: string;
  regions: PlatformProviderRegionResponse[];
}

export interface PlatformProvidersFilters {
  name?: string;
}

export interface ListPlatformProvidersParams {
  filters?: PlatformProvidersFilters;
  pagination?: PaginationOptions;
}

export interface ListPlatformProvidersResponse {
  data: PlatformProviderWithRegionsResponse[];
  pagination: PaginationInfo;
  serverTime?: string;
}

export interface PlatformProviderRegionsFilters {
  q?: string;
  /**
   * Region name
   * @example "ap-southeast-1"
   */
  name?: string;
}

export interface ListPlatformProviderRegionsParams {
  /**
   * Platform provider unique ID
   * @example "83ef9fc3-159c-43fc-a31f-0d4575dc373c"
   */
  platformProviderUid: string;
  filters?: PlatformProviderRegionsFilters;
  sort?: string;
  order?: string;
  pagination?: PaginationOptions;
}

export interface ListPlatformProviderRegionsResponse {
  data: PlatformProviderRegionResponse[];
  pagination: PaginationInfo;
  serverTime?: string;
}
