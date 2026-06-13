import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { Oauth2Service } from '../oauth2/oauth2.service';
import { LinearApiService, LinearIssue, LinearTeam } from './linear-api.service';
import { LINEAR_PROVIDER } from './linear.provider';
import {
  LinearCreateIssueDto,
  LinearIssueIdDto,
  LinearSearchDto,
} from './dto/linear.dto';

// Linear data endpoints, run with the viewing user's own token. The connection
// lifecycle (authorize/status/disconnect/config) lives in Oauth2Controller.
@UseGuards(JwtAuthGuard)
@Controller('integrations/linear')
export class LinearController {
  private readonly logger = new Logger(LinearController.name);

  constructor(
    private readonly oauth2Service: Oauth2Service,
    private readonly linearApiService: LinearApiService,
  ) {}

  /**
   * Runs `fn` with the caller's Linear access token. Returns `disconnected`
   * when there is no usable token, or `errored` when a Linear call fails
   * (degrades to empty results rather than a 500).
   */
  private async withToken<T extends { connected: boolean }>(
    user: User,
    workspace: Workspace,
    disconnected: T,
    errored: T,
    fn: (token: string) => Promise<T>,
  ): Promise<T> {
    const token = await this.oauth2Service.getAccessToken(
      LINEAR_PROVIDER,
      user.id,
      workspace.id,
    );
    if (!token) return disconnected;

    try {
      return await fn(token);
    } catch (err) {
      this.logger.error(`Linear request failed: ${(err as Error)?.message}`);
      return errored;
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post('issues/search')
  searchIssues(
    @Body() dto: LinearSearchDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.withToken(
      user,
      workspace,
      { connected: false, issues: [] as LinearIssue[] },
      { connected: true, issues: [] as LinearIssue[] },
      async (token) => ({
        connected: true,
        issues: dto.query?.trim()
          ? await this.linearApiService.searchIssues(token, dto.query)
          : [],
      }),
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('issues/get')
  getIssue(
    @Body() dto: LinearIssueIdDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.withToken(
      user,
      workspace,
      { connected: false, issue: null as LinearIssue | null },
      { connected: true, issue: null as LinearIssue | null },
      async (token) => ({
        connected: true,
        issue: await this.linearApiService.getIssue(token, dto.issueId),
      }),
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('teams')
  teams(@AuthUser() user: User, @AuthWorkspace() workspace: Workspace) {
    return this.withToken(
      user,
      workspace,
      { connected: false, teams: [] as LinearTeam[] },
      { connected: true, teams: [] as LinearTeam[] },
      async (token) => ({
        connected: true,
        teams: await this.linearApiService.getTeams(token),
      }),
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('issues/create')
  createIssue(
    @Body() dto: LinearCreateIssueDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.withToken(
      user,
      workspace,
      { connected: false, issue: null as LinearIssue | null },
      { connected: true, issue: null as LinearIssue | null },
      async (token) => ({
        connected: true,
        issue: await this.linearApiService.createIssue(token, {
          teamId: dto.teamId,
          title: dto.title,
          description: dto.description,
        }),
      }),
    );
  }
}
