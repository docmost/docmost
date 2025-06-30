# AI Search Module

A comprehensive AI-powered semantic search module for Docmost that integrates with Redis vector database using the official **node-redis** client to provide intelligent search capabilities following Redis vector search specifications.

## Features

- **Semantic Search**: Find content based on meaning rather than exact keywords using vector embeddings
- **Hybrid Search**: Combines both semantic and traditional full-text search with configurable weights
- **Redis Vector Database**: Uses Redis with RediSearch module for efficient vector operations via node-redis client
- **HNSW Indexing**: Hierarchical Navigable Small World algorithm for fast approximate nearest neighbor search
- **Auto-indexing**: Automatically indexes pages when they are created or updated
- **OpenAI-Compatible**: Supports OpenAI and OpenAI-compatible embedding providers
- **Batch Operations**: Efficient batch processing for large-scale indexing
- **Permission-aware**: Respects user permissions and workspace access
- **COSINE Distance**: Uses cosine distance metric for semantic similarity

## Architecture

```
ai-search/
├── ai-search.controller.ts        # REST API endpoints
├── ai-search.module.ts            # Module configuration
├── dto/
│   └── semantic-search.dto.ts     # Request/response DTOs
├── services/
│   ├── ai-search.service.ts       # Main search logic
│   ├── embedding.service.ts       # Text embedding generation
│   ├── redis-vector.service.ts    # Redis vector operations (node-redis)
│   └── vector.service.ts          # Vector math utilities
├── listeners/
│   └── page-update.listener.ts    # Auto-indexing on page changes
├── constants.ts                   # Configuration constants
├── README.md                      # This file
├── SETUP.md                       # Setup guide
└── INTEGRATION.md                 # Integration examples
```

## Configuration

Add these environment variables to your `.env` file:

```env
# Redis Vector Database (using node-redis client)
REDIS_VECTOR_HOST=localhost
REDIS_VECTOR_PORT=6379
REDIS_VECTOR_PASSWORD=your_redis_password
REDIS_VECTOR_DB=0
REDIS_VECTOR_INDEX=docmost_pages

# AI Embedding Configuration (OpenAI-compatible)
AI_EMBEDDING_MODEL=text-embedding-3-small
AI_EMBEDDING_DIMENSIONS=1536
AI_EMBEDDING_BASE_URL=https://api.openai.com/v1/embeddings  # Optional: for custom providers

# OpenAI API Key (or compatible provider key)
OPENAI_API_KEY=your_openai_api_key
```

## Redis Vector Search Implementation

This implementation follows the official [Redis Vector Search specifications](https://redis.io/docs/latest/develop/interact/search-and-query/query/vector-search/) and uses the [node-redis client](https://redis.io/docs/latest/develop/clients/nodejs/vecsearch/) for proper integration.

### Key Features:
- **HNSW Algorithm**: Uses Hierarchical Navigable Small World for fast vector indexing
- **COSINE Distance**: Semantic similarity using cosine distance metric
- **KNN Queries**: K-nearest neighbors search with `*=>[KNN k @embedding $vector AS distance]`
- **Hash Storage**: Vectors stored as Redis hash documents with binary embedding data
- **node-redis Client**: Official Redis client with full vector search support

### Vector Index Schema:
```typescript
{
  page_id: SchemaFieldTypes.TEXT,          // Sortable page identifier
  workspace_id: SchemaFieldTypes.TEXT,     // Sortable workspace filter
  space_id: SchemaFieldTypes.TEXT,         // Space filter
  title: SchemaFieldTypes.TEXT,            // Page title
  embedding: {                             // Vector field
    type: SchemaFieldTypes.VECTOR,
    ALGORITHM: VectorAlgorithms.HNSW,      // HNSW indexing
    TYPE: 'FLOAT32',                       // 32-bit floats
    DIM: 1536,                             // Embedding dimensions
    DISTANCE_METRIC: 'COSINE',             // Cosine similarity
  },
  indexed_at: SchemaFieldTypes.NUMERIC     // Indexing timestamp
}
```

## API Endpoints

### Semantic Search
```http
POST /ai-search/semantic
Content-Type: application/json

{
  "query": "machine learning algorithms",
  "spaceId": "optional-space-id",
  "limit": 20,
  "similarity_threshold": 0.7
}
```

### Hybrid Search
```http
POST /ai-search/hybrid
Content-Type: application/json

{
  "query": "neural networks",
  "spaceId": "optional-space-id", 
  "limit": 20
}
```

### Reindex Pages
```http
POST /ai-search/reindex
Content-Type: application/json

{
  "spaceId": "optional-space-id",
  "pageIds": ["page-id-1", "page-id-2"]
}
```

## Usage Examples

### Basic Semantic Search
```typescript
import { AiSearchService } from './ai-search.service';

// Search for pages semantically using vector similarity
const results = await aiSearchService.semanticSearch(
  'artificial intelligence concepts',
  { limit: 10, similarity_threshold: 0.8 },
  { userId: 'user-id', workspaceId: 'workspace-id' }
);
```

### Hybrid Search with Weighted Scoring
```typescript
// Combine semantic (70%) and text search (30%)
const results = await aiSearchService.hybridSearch(
  'machine learning tutorial',
  { spaceId: 'space-id', limit: 15 },
  { userId: 'user-id', workspaceId: 'workspace-id' }
);
```

## Dependencies

The module uses the official **node-redis** package for Redis integration:

```json
{
  "redis": "^4.7.0"
}
```

Install with pnpm:
```bash
pnpm install
```

## Performance Optimizations

### Vector Search Performance
- **HNSW Algorithm**: Provides O(log n) search complexity
- **COSINE Distance**: Efficient for normalized embeddings
- **Batch Operations**: Multi-command execution for bulk indexing
- **Connection Pooling**: Persistent Redis connections

### Memory Efficiency
- **Float32 Vectors**: Reduced memory usage vs Float64
- **TTL Expiration**: Automatic cleanup of old vectors (30 days)
- **Prefix-based Storage**: Organized key structure

## Vector Storage Format

Vectors are stored as Redis hash documents:
```
Key: vector:{workspaceId}:{pageId}
Fields:
  page_id: "page-uuid"
  workspace_id: "workspace-uuid"  
  space_id: "space-uuid"
  title: "Page Title"
  embedding: Buffer<Float32Array>  // Binary vector data
  indexed_at: "1234567890"
```

## Error Handling

The module includes comprehensive error handling:

- **Connection Resilience**: Automatic reconnection on Redis failures
- **Embedding Retries**: Exponential backoff for API failures  
- **Vector Validation**: Dimension and format checking
- **Graceful Degradation**: Fallback to text search on vector errors

This implementation provides production-ready vector search capabilities that scale with your content while maintaining excellent search quality and performance. 