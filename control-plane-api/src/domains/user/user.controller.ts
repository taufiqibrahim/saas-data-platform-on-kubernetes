// import * as express from 'express';
// import { Controller, Get, Middlewares, Request, Route, SuccessResponse, Tags } from 'tsoa';
// import { authenticationMiddleware } from '@/middlewares/authentication.middleware';
// import * as UserService from './user.service';
// import { OwnUserInfo } from './user.type';

// @Route('user')
// @Tags('User')
// @Middlewares(authenticationMiddleware)
// export class UserController extends Controller {
//   /**
//    * Retrieves the current user information.
//    * @summary Me
//    */
//   @Get('/me')
//   @SuccessResponse(200)
//   public async me(@Request() req: express.Request): Promise<OwnUserInfo> {
//     return await UserService.getOwnUserInfo({ principal: req.principal });
//   }
// }
