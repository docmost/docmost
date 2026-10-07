import { Injectable } from '@nestjs/common';
import {
  IntegrationProvider,
  IntegrationDefinition,
  LinkDescription,
  UnfurlOpts,
  UnfurlResult,
} from '../../registry/integration-provider.interface';
import { LinearService } from './linear.service';
import { linearPatterns } from './linear-patterns';

@Injectable()
export class LinearProvider extends IntegrationProvider {
  definition: IntegrationDefinition = {
    type: 'linear',
    name: 'Linear',
    description: 'Link previews for issues, projects, initiatives, and views',
    icon: 'linear',
    capabilities: ['oauth', 'unfurl'],
    oauth: {
      authUrl: 'https://linear.app/oauth/authorize',
      tokenUrl: 'https://api.linear.app/oauth/token',
      scopes: ['read'],
    },
    unfurlPatterns: linearPatterns,
  };

  constructor(private readonly linearService: LinearService) {
    super();
  }

  async unfurl(opts: UnfurlOpts): Promise<UnfurlResult> {
    const { match, patternType, accessToken, url } = opts;
    const teamSlug = match[1];

    switch (patternType) {
      case 'linear-issue': {
        const issueId = match[2];
        return this.linearService.unfurlIssue(accessToken, issueId, url);
      }

      case 'linear-project': {
        const slugId = match[2];
        return this.linearService.unfurlProject(accessToken, slugId, teamSlug, url);
      }

      case 'linear-initiative': {
        const slugId = match[2];
        return this.linearService.unfurlInitiative(accessToken, slugId, teamSlug, url);
      }

      case 'linear-view': {
        const viewId = match[2];
        return this.linearService.unfurlView(teamSlug, viewId, url);
      }

      default:
        throw new Error(`Unknown Linear pattern type: ${patternType}`);
    }
  }

  describeLink(
    patternType: string,
    match: RegExpMatchArray,
  ): LinkDescription | null {
    const workspace = match[1];
    switch (patternType) {
      case 'linear-issue': {
        const titleSlug = match[3] ? this.humanizeSlug(match[3]) : null;
        return {
          title: `Issue ${match[2]}`,
          description: titleSlug ?? workspace,
        };
      }
      case 'linear-project':
        return {
          title: this.humanizeSlug(match[2]) ?? 'Project',
          description: 'Project',
        };
      case 'linear-initiative':
        return {
          title: this.humanizeSlug(match[2]) ?? 'Initiative',
          description: 'Initiative',
        };
      case 'linear-view':
        return { title: 'View', description: workspace };
      default:
        return null;
    }
  }

  // "mobile-app-1b9607f47174" -> "Mobile app": slugs end in a hex id segment.
  private humanizeSlug(slug: string): string | null {
    const name = slug
      .replace(/-[a-f0-9]{8,}$/, '')
      .replace(/-/g, ' ')
      .trim();
    if (!name || /^[a-f0-9]{8,}$/.test(name)) return null;
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
}
