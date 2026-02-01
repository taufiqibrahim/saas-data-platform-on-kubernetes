import { Controller, Get, Path, Query, Response, Route, Tags } from 'tsoa';

import * as PlatformService from './platform.service';
import {
  ListPlatformProviderRegionsResponse,
  ListPlatformProvidersResponse,
} from './platform.type';

@Route('platformProviders')
@Tags('Platform Providers')
export class PlatformController extends Controller {
  /**
   * Retrieves the list of supported platform providers.
   * @summary List platform providers
   */
  @Get('/')
  @Response<{ message: string }>(500, 'Internal Server Error')
  public async listPlatformProviders() // @Path() accountUid: string
  : Promise<ListPlatformProvidersResponse> {
    const response = await PlatformService.listPlatformProviders({
      filters: {},
    });
    return response;
  }

  /**
   * Retrieves the list of supported regions of a platform provider.
   * @summary List platform provider regions
   */
  @Get('/{platformProviderUid}/regions')
  @Response<{ message: string }>(500, 'Internal Server Error')
  public async listPlatformProviderRegions(
    @Path() platformProviderUid: string,
    @Query() _filters?: string,
    @Query() _sort?: string,
    @Query() _order?: string,
    @Query() page?: number,
    @Query() limit?: number,
  ): Promise<ListPlatformProviderRegionsResponse> {
    const filters = _filters ? JSON.parse(_filters) : {};
    const response = await PlatformService.listPlatformProviderRegions({
      platformProviderUid,
      filters,
      sort: _sort,
      order: _order,
      pagination: { page, limit },
    });
    return response;
  }
}
