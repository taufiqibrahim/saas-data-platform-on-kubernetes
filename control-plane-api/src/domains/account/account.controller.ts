import * as express from 'express';
import { Controller, Get, Middlewares, Path, Request, Route, Tags } from 'tsoa';

import { authenticationMiddleware } from '@/middlewares/authentication.middleware';

import { AccountResponse } from '../account/account.type';
import * as AccountService from './account.service';

@Route('accounts')
@Tags('Accounts')
@Middlewares(authenticationMiddleware)
export class AccountController extends Controller {
  /**
   * Retrieves the detail of an account.
   * Supply the unique account UID.
   * @summary Get account detail
   */
  @Get('/{accountUid}')
  public async getAccount(
    @Request() req: express.Request,
    @Path() accountUid: string,
  ): Promise<AccountResponse | null> {
    const result = await AccountService.getAccount({
      principal: req.principal,
      accountUid,
    });
    return result;
  }

  // /**
  //  * Update account.
  //  * Supply the unique account UID and the update payload.
  //  * @summary Update account
  //  */
  // @Patch('/')
  // public async patchAccount(@Request() req: express.Request, @Body() body: PartialAccountPatchInput): Promise<Account> {
  //   return await AccountService.patchAccount(req.accountUid, req.user.id, body);
  // }
}
