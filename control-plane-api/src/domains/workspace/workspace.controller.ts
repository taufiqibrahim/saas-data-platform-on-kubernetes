import * as express from 'express';
import {
  Body,
  Controller,
  Get,
  Middlewares,
  Path,
  // Path,
  Post,
  Query,
  Request,
  Response,
  Route,
  SuccessResponse,
  Tags,
} from 'tsoa';

import { authenticationMiddleware } from '@/middlewares/authentication.middleware';

import * as WorkspaceService from './workspace.service';
import { CreateWorkspaceRequestBody, GenerateBootstrapTokenResponse, ListWorkspacesResponse, WorkspaceResponse } from './workspace.type';
import { ValidateErrorJSON } from '../_shared/shared.type';

// import { PartialWorkspacePatchInput, Workspace, WorkspaceCreateInput, WorkspaceList, WorkspaceProvisioningConfig, WorkspaceProvisioningConfigList, WorkspaceProvisionConfigResponse } from './workspace.type';

@Route('workspaces')
@Tags('Workspaces')
@Middlewares(authenticationMiddleware)
export class WorkspaceController extends Controller {
  /**
   * Retrieves the list of workspaces.
   * @summary List workspaces
   */
  @Get('/')
  @SuccessResponse(200)
  public async listWorkspaces(
    @Request() req: express.Request,
    @Query() _filters?: string,
    @Query() _sort?: string,
    @Query() _order?: string,
    @Query() page?: number,
    @Query() limit?: number,
  ): Promise<ListWorkspacesResponse> {
    const filters = _filters ? JSON.parse(_filters) : {};
    const result = await WorkspaceService.listWorkspaces({
      principal: req.principal,
      filters,
      sort: _sort,
      order: _order,
      pagination: { page, limit },
    });
    return result;
  }

  /**
   * Retrieves the detail of a workspace.
   * Supply the unique workspace UID.
   * @summary Get workspace detail
   */
  @Get('/{workspaceUid}')
  public async getWorkspace(
    @Request() req: express.Request,
    @Path() workspaceUid: string
  ): Promise<WorkspaceResponse | null> {
    const result = await WorkspaceService.getWorkspace({
      principal: req.principal,
      workspaceUid,
    });
    return result;
  }

  /**
   * Create a workspace.
   * Supply the workspace create input body.
   * @summary Create workspace
   */
  @Post('/')
  @SuccessResponse('201', 'Created')
  @Response<ValidateErrorJSON>(400, 'Validation Failed')
  public async createWorkspace(
    @Request() req: express.Request,
    @Body() data: CreateWorkspaceRequestBody,
  ): Promise<WorkspaceResponse | null> {
    // const prisma = new PrismaClient();
    // const workspace = await prisma.$transaction(async (tx) => {
    //   return await WorkspaceService.createWorkspaceTx(tx, {
    //     name: body.name,
    //     description: body.description,
    //     accountUid: req.accountUid,
    //     extWorkspaceId: body.extWorkspaceId,
    //     cloudRegionUid: body.cloudRegionUid,
    //     accountCredentialUid: body.accountCredentialUid,
    //     accountNetworkUid: body.accountNetworkUid,
    //     accountStorageUid: body.accountStorageUid,
    //     createdById: req.user.id as unknown as bigint,
    //   });
    // });
    return await WorkspaceService.provisionWorkspace({
      principal: req.principal,
      data,
    });
  }

  /**
   * Generate a new bootstrap token for a workspace.
   * Invalidates the existing token and resets agent status to PendingRegistration.
   * @summary Generate new bootstrap token
   */
  @Post('/{workspaceUid}/generateBootstrapToken')
  @SuccessResponse('200', 'Token Generated')
  @Response<ValidateErrorJSON>(400, 'Validation Failed')
  public async generateBootstrapToken(
    @Request() req: express.Request,
    @Path() workspaceUid: string
  ): Promise<GenerateBootstrapTokenResponse> {
    return await WorkspaceService.generateBootstrapToken({
      principal: req.principal,
      workspaceUid,
    });
  }

  // /**
  //  * Create new workspace provision config
  //  * @summary Create new workspace provision config
  //  */
  // @Post('/{workspaceUid}/provisionConfig')
  // @SuccessResponse('202', 'Accepted')
  // @Response<ValidateErrorJSON>(400, 'Validation Failed')
  // public async createProvisionConfig(@Request() req: express.Request, @Path() workspaceUid: string): Promise<WorkspaceProvisionConfigResponse> {
  //   const prisma = new PrismaClient();
  //   const workspaceProvisioningConfig = await prisma.$transaction(async (tx) => {
  //     return await WorkspaceService.createWorkspaceProvisioningConfigTx(tx, workspaceUid, req.user.id,
  //       {
  //         tfvarsOverride: req.body.tfvarsOverride
  //       }
  //     );
  //   });
  //   return workspaceProvisioningConfig;
  // }

  // /**
  //  * List workspace provision configs
  //  * @summary List workspace provision configs
  //  */
  // @Get('/{workspaceUid}/provisionConfig')
  // @SuccessResponse(200)
  // @Response<ValidateErrorJSON>(400, 'Validation Failed')
  // public async listProvisionConfig(@Request() _req: express.Request, @Path() workspaceUid: string): Promise<WorkspaceProvisioningConfigList> {
  //   return await WorkspaceService.listWorkspaceProvisioningConfigs(workspaceUid);
  // }

  // /**
  //  * Get current workspace provision config
  //  * @summary Get current workspace provision config
  //  */
  // @Get('/{workspaceUid}/currentProvisionConfig')
  // @SuccessResponse(200)
  // @Response<ValidateErrorJSON>(400, 'Validation Failed')
  // public async getProvisionConfig(@Request() _req: express.Request, @Path() workspaceUid: string): Promise<WorkspaceProvisioningConfig> {
  //   return await WorkspaceService.getWorkspaceCurrentProvisioningConfig(workspaceUid);
  // }

  // /**
  //  * Set Keycloak config for a workspace which includes Keycloak
  //  * @summary Set workspace Keycloak config
  //  */
  // @Post('/{workspaceUid}/ensureKeycloakConfig')
  // @SuccessResponse('202', 'Accepted')
  // @Response<ValidateErrorJSON>(400, 'Validation Failed')
  // public async ensureKeycloakConfig(@Request() req: express.Request, @Path() workspaceUid: string) {
  //   await WorkspaceService.ensureWorkspaceKeycloakConfig(workspaceUid, req.user.id);
  // }

  // /**
  //  * Update workspace.
  //  * Supply the unique workspace UID and the update payload.
  //  * @summary Update workspace
  //  */
  // @Patch('/{workspaceUid}')
  // public async patchWorkspace(@Request() req: express.Request, @Path() workspaceUid: string, @Body() body: PartialWorkspacePatchInput): Promise<Workspace> {
  //   const prisma = new PrismaClient();
  //   const workspace = await prisma.$transaction(async (tx) => {
  //     return await WorkspaceService.patchWorkspaceTx(tx, workspaceUid, req.user.id, body);
  //   });
  //   return workspace;
  // }

  // /**
  //  * Delete workspace.
  //  * Supply the unique workspace UID.
  //  * @summary Delete workspace
  //  */
  // @Delete('/{workspaceUid}')
  // public async deleteWorkspace(@Request() req: express.Request, @Path() workspaceUid: string): Promise<Workspace> {
  //   const prisma = new PrismaClient();
  //   const workspace = await prisma.$transaction(async (tx) => {
  //     return await WorkspaceService.deleteWorkspaceTx(tx, workspaceUid, req.user.id);
  //   });
  //   return workspace;
  // }
}
