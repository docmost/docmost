import { DB } from '@docmost/db/types/db';
import { PageEmbeddings } from '@docmost/db/types/embeddings.types';
import {
  Integrations,
  IntegrationConnections,
  IntegrationWebhooks,
} from '@docmost/db/types/db';

export interface DbInterface extends DB {
  pageEmbeddings: PageEmbeddings;
  integrations: Integrations;
  integrationConnections: IntegrationConnections;
  integrationWebhooks: IntegrationWebhooks;
}
