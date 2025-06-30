# AI Search Setup Guide

This guide will help you set up the AI Search module with Redis vector database for Docmost.

## Prerequisites

1. **Redis with RediSearch**: You need Redis with the RediSearch module for vector operations
2. **OpenAI API Key**: For embedding generation (or alternative provider)
3. **Node.js Dependencies**: The required packages are already added to package.json

## Step 1: Install Redis with RediSearch

### Option A: Using Docker (Recommended)

```bash
# Using Redis Stack (includes RediSearch and vector capabilities)
docker run -d --name redis-stack \
  -p 6379:6379 \
  -v redis-data:/data \
  redis/redis-stack-server:latest

# Or using Redis Enterprise with RediSearch
docker run -d --name redis-vector \
  -p 6379:6379 \
  -v redis-data:/data \
  redislabs/redisearch:latest
```

### Option B: Manual Installation

1. Install Redis from source with RediSearch module
2. Or use Redis Cloud with RediSearch enabled

## Step 2: Configure Environment Variables

Add these variables to your `.env` file:

```env
# ===== Redis Vector Database Configuration =====
REDIS_VECTOR_HOST=localhost
REDIS_VECTOR_PORT=6379
REDIS_VECTOR_PASSWORD=your_redis_password_here
REDIS_VECTOR_DB=0
REDIS_VECTOR_INDEX=docmost_pages

# ===== AI Embedding Configuration (OpenAI-compatible) =====
AI_EMBEDDING_MODEL=text-embedding-3-small
AI_EMBEDDING_DIMENSIONS=1536
AI_EMBEDDING_BASE_URL=https://api.openai.com/v1/embeddings  # Optional: for custom providers

# ===== OpenAI API Key (or compatible provider key) =====
OPENAI_API_KEY=your_openai_api_key_here
```

## Step 3: Custom OpenAI-Compatible Providers

You can use any provider that follows the OpenAI embeddings API specification by setting the `AI_EMBEDDING_BASE_URL`:

### Examples:

**Azure OpenAI:**
```env
AI_EMBEDDING_BASE_URL=https://your-resource.openai.azure.com/openai/deployments/your-deployment/embeddings?api-version=2023-05-15
OPENAI_API_KEY=your_azure_openai_key
```

**Ollama (local):**
```env
AI_EMBEDDING_BASE_URL=http://localhost:11434/v1/embeddings
AI_EMBEDDING_MODEL=nomic-embed-text
AI_EMBEDDING_DIMENSIONS=768
```

**Other compatible providers:**
- Together AI
- Anyscale
- OpenRouter
- Any provider implementing OpenAI's embeddings API

## Step 4: Install Dependencies

The required dependencies are already in package.json. Run:

```bash
pnpm install
```

## Step 5: Initialize the Vector Index

The vector index will be created automatically when the service starts. You can also manually trigger reindexing:

```bash
# Using the API endpoint
curl -X POST http://localhost:3000/ai-search/reindex \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"workspaceId": "your-workspace-id"}'
```

## Step 6: Test the Setup

### Test Semantic Search
```bash
curl -X POST http://localhost:3000/ai-search/semantic \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "query": "machine learning algorithms",
    "limit": 10,
    "similarity_threshold": 0.7
  }'
```

### Test Hybrid Search
```bash
curl -X POST http://localhost:3000/ai-search/hybrid \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "query": "neural networks",
    "limit": 10
  }'
```

## Step 7: Monitor the Setup

### Check Redis Connection
```bash
redis-cli ping
# Should return PONG
```

### Check RediSearch Module
```bash
redis-cli MODULE LIST
# Should show RediSearch in the list
```

### Check Index Status
```bash
redis-cli FT.INFO docmost_pages
# Should show index information
```

## Troubleshooting

### Common Issues

1. **Redis Connection Error**
   - Check if Redis is running: `docker ps` or `redis-cli ping`
   - Verify connection details in .env file
   - Check firewall/network settings

2. **RediSearch Module Not Found**
   - Ensure you're using Redis Stack or Redis with RediSearch
   - Check module is loaded: `redis-cli MODULE LIST`

3. **OpenAI API Errors**
   - Verify API key is correct and has sufficient credits
   - Check API usage limits and quotas
   - Ensure model name is correct

4. **Embedding Generation Fails**
   - Check text length (max 8000 characters by default)
   - Verify network connectivity to embedding provider
   - Check API rate limits

5. **Search Returns No Results**
   - Ensure pages are indexed: check logs for indexing errors
   - Verify similarity threshold (try lowering it)
   - Check user permissions for searched content

### Debug Logging

Enable debug logging by setting:
```env
LOG_LEVEL=debug
```

### Performance Tuning

1. **Batch Size**: Adjust based on your API rate limits
   ```env
   AI_SEARCH_BATCH_SIZE=50  # Lower for rate-limited APIs
   ```

2. **Similarity Threshold**: Balance precision vs recall
   ```env
   AI_SEARCH_SIMILARITY_THRESHOLD=0.6  # Lower = more results
   ```

3. **Redis Memory**: Monitor memory usage as index grows
   ```bash
   redis-cli INFO memory
   ```

## Production Deployment

### Redis Configuration
- Use Redis Cluster for high availability
- Set up proper backup and persistence
- Monitor memory usage and performance
- Configure appropriate TTL for vectors

### Security
- Use strong Redis passwords
- Enable TLS for Redis connections
- Secure API keys in environment variables
- Implement proper rate limiting

### Monitoring
- Set up alerts for Redis health
- Monitor embedding API usage and costs
- Track search performance metrics
- Log search queries for analysis

## Next Steps

1. **Auto-indexing**: Pages are automatically indexed on create/update
2. **Client Integration**: Add AI search to your frontend
3. **Custom Scoring**: Implement custom ranking algorithms
4. **Analytics**: Track search usage and effectiveness

For more detailed information, see the main README.md file. 