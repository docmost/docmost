export const AI_SEARCH_CONFIG = {
  // Default similarity thresholds
  DEFAULT_SIMILARITY_THRESHOLD: 0.7,
  HIGH_SIMILARITY_THRESHOLD: 0.85,
  LOW_SIMILARITY_THRESHOLD: 0.6,

  // Search limits
  MAX_SEARCH_LIMIT: 100,
  DEFAULT_SEARCH_LIMIT: 20,
  MIN_SEARCH_LIMIT: 1,

  // Embedding configuration
  DEFAULT_EMBEDDING_DIMENSIONS: 1536,
  MAX_TEXT_LENGTH: 8000,
  
  // Indexing configuration
  DEFAULT_BATCH_SIZE: 100,
  INDEX_TTL_DAYS: 30,
  
  // Hybrid search weights
  SEMANTIC_WEIGHT: 0.7,
  TEXT_WEIGHT: 0.3,
  
  // Redis configuration
  REDIS_KEY_PREFIX: 'docmost:ai-search',
  VECTOR_KEY_PREFIX: 'vector',
  METADATA_KEY_PREFIX: 'metadata',
  
  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
  
  // OpenAI configuration
  OPENAI_BATCH_SIZE: 100,
} as const;

export const EMBEDDING_MODELS = {
  OPENAI: {
    'text-embedding-3-small': 1536,
    'text-embedding-3-large': 3072,
    'text-embedding-ada-002': 1536,
  },
} as const;

export const SEARCH_EVENTS = {
  PAGE_CREATED: 'page.created',
  PAGE_UPDATED: 'page.updated',
  PAGE_DELETED: 'page.deleted',
  BULK_REINDEX: 'ai-search.bulk-reindex',
} as const; 