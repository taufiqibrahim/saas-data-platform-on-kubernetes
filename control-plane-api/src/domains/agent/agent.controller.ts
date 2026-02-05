import {
  Body,
  Controller,
  Post,
  Response,
  Route,
  SuccessResponse,
  Tags,
} from 'tsoa';

import * as WorkspaceService from '../workspace/workspace.service';
import { AgentRegisterRequest, AgentRegisterResponse } from '../workspace/workspace.type';
import { ValidateErrorJSON } from '../_shared/shared.type';

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
}
