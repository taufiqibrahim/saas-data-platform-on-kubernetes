import * as express from 'express';
import {
  Body,
  Controller,
  Get,
  Middlewares,
  Post,
  Query,
  Request,
  Response,
  Route,
  SuccessResponse,
  Tags,
} from 'tsoa';

import { authenticationMiddleware } from '@/middlewares/authentication.middleware';

import * as AccountService from '../account/account.service';
import {
  AccountResponse,
  ListAccountsResponse,
  ProvisionAccountRequestBody,
} from '../account/account.type';
import * as PrincipalService from '../principal/principal.service';
import { ListPrincipalsResponse } from '../principal/principal.type';
import * as AdminService from './admin.service';

@Route('admin')
@Middlewares(authenticationMiddleware)
@Tags('Admin API')
export class AdminController extends Controller {
  /**
   * Retrieves the list of principals.
   * @summary List principals
   */
  @Get('/principals')
  @Response<{ message: string }>(500, 'Internal Server Error')
  public async listPrincipals(
    @Request() req: express.Request,
    @Query() _filters?: string,
    @Query() _sort?: string,
    @Query() _order?: string,
    @Query() page?: number,
    @Query() limit?: number,
  ): Promise<ListPrincipalsResponse> {
    const filters = _filters ? JSON.parse(_filters) : {};
    const response = await PrincipalService.listPrincipals({
      principal: req.principal,
      filters,
      sort: _sort,
      order: _order,
      pagination: { page, limit },
    });
    return response;
  }

  /**
   * Retrieves the list of accounts.
   * @summary List accounts
   */
  @Get('/accounts')
  @Response<{ message: string }>(500, 'Internal Server Error')
  public async listAccounts(
    @Request() req: express.Request,
    @Query() _filters?: string,
    @Query() _sort?: string,
    @Query() _order?: string,
    @Query() page?: number,
    @Query() limit?: number,
  ): Promise<ListAccountsResponse> {
    const filters = _filters ? JSON.parse(_filters) : {};
    const response = await AccountService.listAllAccounts({
      principal: req.principal,
      filters,
      sort: _sort,
      order: _order,
      pagination: { page, limit },
    });
    return response;
  }

  /**
   * Provision new account
   * @summary Provision new account
   */
  @Post('/accounts')
  @SuccessResponse(201)
  public async provisionAccount(
    @Request() req: express.Request,
    @Body() data: ProvisionAccountRequestBody,
  ): Promise<AccountResponse | null> {
    return await AdminService.provisionAccount({
      principal: req.principal,
      data,
    });
  }
}
