import { UnfurlPattern } from '../../registry/integration-provider.interface';
import { CANONICAL_PATH } from '../../utils/canonical-path';

const LINEAR_APP = String.raw`^https?:\/\/${CANONICAL_PATH}linear\.app`;

export const linearPatterns: UnfurlPattern[] = [
  // Issue: /:team/issue/:KEY-123(/:title-slug)?(#comment)?
  {
    regex: new RegExp(
      String.raw`${LINEAR_APP}\/([^\/]+)\/issue\/([A-Z]+-\d+)(?:\/([^\/?#]+))?`,
    ),
    type: 'linear-issue',
  },
  // Project: /:team/project/:slug(/:tab)?
  {
    regex: new RegExp(String.raw`${LINEAR_APP}\/([^\/]+)\/project\/([^\/]+)`),
    type: 'linear-project',
  },
  // Initiative: /:team/initiative/:slug(/:tab)?
  {
    regex: new RegExp(String.raw`${LINEAR_APP}\/([^\/]+)\/initiative\/([^\/]+)`),
    type: 'linear-initiative',
  },
  // View: /:team/view/:id(/:tab)?
  {
    regex: new RegExp(String.raw`${LINEAR_APP}\/([^\/]+)\/view\/([^\/]+)`),
    type: 'linear-view',
  },
];
