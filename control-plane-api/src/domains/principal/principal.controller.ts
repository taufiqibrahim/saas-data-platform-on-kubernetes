// import { Controller, Get, Middlewares, Request, Response, Route, Tags } from 'tsoa';
// import * as express from 'express';
// import { ListPrincipalsResponse } from './principal.type';
// import * as PrincipalService from './principal.service'
// import { authenticationMiddleware } from '@/middlewares/authentication.middleware';

// @Route('principals')
// @Middlewares(authenticationMiddleware)
// @Tags('Principal')
// export class PrincipalController extends Controller {
//   /**
//    * Retrieves the list of principals.
//    * @summary List principals
//    */
//   @Get('/')
//   @Response<{ message: string }>(500, 'Internal Server Error')
//   public async listPrincipals(@Request() req: express.Request): Promise<ListPrincipalsResponse> {
//     const response = await PrincipalService.listPrincipals({
//       principal: req.principal,
//       filters: {},
//       pagination: {},
//     })
//     return response;
//   }
// }
