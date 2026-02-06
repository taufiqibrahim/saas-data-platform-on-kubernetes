import {
  Body,
  Controller,
  Middlewares,
  Post,
  Request,
  Response,
  Route,
  SuccessResponse,
  Tags,
} from 'tsoa';
import express from 'express';

import * as WorkspaceService from '../workspace/workspace.service';
import { AgentRegisterRequest, AgentRegisterResponse, AgentSyncRequest, AgentSyncResponse } from '../workspace/workspace.type';
import { ValidateErrorJSON } from '../_shared/shared.type';
import { requireMTLS } from '@/middlewares/mtls.middleware';

@Route('agent')
@Tags('Agent')
export class AgentController extends Controller {
  /**
   * Register a workspace cluster agent using a bootstrap token.
   * This endpoint is unauthenticated - the bootstrap token serves as the credential.
   * Upon successful registration, the agent receives mTLS certificates for secure communication.
   * @summary Register agent
   */
  @Post('/register')
  @SuccessResponse('200', 'Registered')
  @Response<ValidateErrorJSON>(400, 'Validation Failed')
  @Response<{ message: string }>(401, 'Invalid or expired token')
  @Response<{ message: string }>(403, 'Agent is suspended')
  @Response<{ message: string }>(409, 'Agent already registered')
  @Response<{ message: string }>(410, 'Agent has been deleted')
  public async registerAgent(
    @Body() data: AgentRegisterRequest,
  ): Promise<AgentRegisterResponse> {
    return await WorkspaceService.registerWorkspaceClusterAgent(data);
  }

  /**
   * Sync agent state with control plane.
   * Agent sends telemetry/status and receives workspace configuration.
   * This endpoint requires mTLS authentication - the agent identity is extracted from the client certificate.
   * @summary Sync agent
   */
  @Post('/sync')
  @Middlewares(requireMTLS)
  @SuccessResponse('200', 'Synced')
  @Response<{ message: string }>(401, 'Invalid or missing certificate')
  @Response<{ message: string }>(403, 'Agent is suspended or not registered')
  @Response<{ message: string }>(404, 'Agent not found')
  @Response<{ message: string }>(410, 'Agent has been deleted')
  public async syncAgent(
    @Request() req: express.Request,
    @Body() data: AgentSyncRequest,
  ): Promise<AgentSyncResponse> {
    const agentUid = (req as any).agentId;
    return await WorkspaceService.syncAgent({ agentUid, data });
  }
}
