# AI Search Integration Guide

This guide shows how to integrate the AI Search module with your existing page operations for automatic indexing.

## Event-Based Auto-Indexing

The AI Search module uses event listeners to automatically index pages when they are created, updated, or deleted.

### Emitting Events in Page Service

Update your existing `PageService` to emit events for AI search indexing:

```typescript
// In your page.service.ts
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Injectable } from '@nestjs/common';

@Injectable()
export class PageService {
  constructor(
    private readonly eventEmitter: EventEmitter2,
    // ... other dependencies
  ) {}

  async createPage(createPageDto: CreatePageDto): Promise<Page> {
    // Your existing page creation logic
    const page = await this.pageRepo.create(createPageDto);
    
    // Emit event for AI search indexing
    this.eventEmitter.emit('page.created', {
      pageId: page.id,
      workspaceId: page.workspaceId,
      spaceId: page.spaceId,
      title: page.title,
      textContent: page.textContent,
      operation: 'create'
    });

    return page;
  }

  async updatePage(pageId: string, updatePageDto: UpdatePageDto): Promise<Page> {
    // Your existing page update logic
    const page = await this.pageRepo.update(pageId, updatePageDto);
    
    // Emit event for AI search reindexing
    this.eventEmitter.emit('page.updated', {
      pageId: page.id,
      workspaceId: page.workspaceId,
      spaceId: page.spaceId,
      title: page.title,
      textContent: page.textContent,
      operation: 'update'
    });

    return page;
  }

  async deletePage(pageId: string): Promise<void> {
    // Get page info before deletion
    const page = await this.pageRepo.findById(pageId);
    
    // Your existing page deletion logic
    await this.pageRepo.delete(pageId);
    
    // Emit event for AI search cleanup
    if (page) {
      this.eventEmitter.emit('page.deleted', {
        pageId: page.id,
        workspaceId: page.workspaceId,
        spaceId: page.spaceId,
        operation: 'delete'
      });
    }
  }
}
```

### Adding EventEmitter to Page Module

Make sure your `PageModule` imports the `EventEmitterModule`:

```typescript
// In your page.module.ts
import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PageService } from './services/page.service';
import { PageController } from './page.controller';

@Module({
  imports: [
    EventEmitterModule, // Add this if not already present
  ],
  controllers: [PageController],
  providers: [PageService],
  exports: [PageService],
})
export class PageModule {}
```

### Bulk Operations

For bulk operations, you can emit multiple events or use a bulk reindex:

```typescript
async bulkUpdatePages(updates: BulkUpdateDto[]): Promise<Page[]> {
  const updatedPages = await this.pageRepo.bulkUpdate(updates);
  
  // Option 1: Emit individual events
  for (const page of updatedPages) {
    this.eventEmitter.emit('page.updated', {
      pageId: page.id,
      workspaceId: page.workspaceId,
      spaceId: page.spaceId,
      title: page.title,
      textContent: page.textContent,
      operation: 'update'
    });
  }
  
  // Option 2: Use bulk reindex (more efficient for large batches)
  // const pageIds = updatedPages.map(p => p.id);
  // this.eventEmitter.emit('ai-search.bulk-reindex', {
  //   pageIds,
  //   workspaceId: updatedPages[0]?.workspaceId
  // });

  return updatedPages;
}
```

## Manual Integration

If you prefer manual control over indexing, you can directly use the AI search services:

```typescript
// In your page.service.ts
import { AiSearchService } from '../ai-search/services/ai-search.service';

@Injectable()
export class PageService {
  constructor(
    private readonly aiSearchService: AiSearchService,
    // ... other dependencies
  ) {}

  async createPageWithSearch(createPageDto: CreatePageDto): Promise<Page> {
    const page = await this.pageRepo.create(createPageDto);
    
    // Manually trigger indexing
    try {
      await this.aiSearchService.reindexPages({
        pageIds: [page.id],
        workspaceId: page.workspaceId
      });
    } catch (error) {
      // Log error but don't fail the page creation
      console.error('Failed to index page for AI search:', error);
    }

    return page;
  }
}
```

## Frontend Integration

### Adding AI Search to Client

Create AI search service on the client side:

```typescript
// apps/client/src/features/ai-search/services/ai-search-service.ts
import api from "@/lib/api-client";

export interface AiSearchParams {
  query: string;
  spaceId?: string;
  limit?: number;
  similarity_threshold?: number;
}

export interface AiSearchResult {
  id: string;
  title: string;
  icon: string;
  similarity_score: number;
  highlight: string;
  space?: {
    id: string;
    name: string;
    slug: string;
  };
}

export async function semanticSearch(params: AiSearchParams): Promise<AiSearchResult[]> {
  const response = await api.post<AiSearchResult[]>("/ai-search/semantic", params);
  return response.data;
}

export async function hybridSearch(params: AiSearchParams): Promise<AiSearchResult[]> {
  const response = await api.post<AiSearchResult[]>("/ai-search/hybrid", params);
  return response.data;
}
```

### React Query Integration

```typescript
// apps/client/src/features/ai-search/queries/ai-search-query.ts
import { useQuery } from "@tanstack/react-query";
import { semanticSearch, hybridSearch, AiSearchParams } from "../services/ai-search-service";

export function useAiSemanticSearchQuery(params: AiSearchParams) {
  return useQuery({
    queryKey: ["ai-search", "semantic", params],
    queryFn: () => semanticSearch(params),
    enabled: !!params.query && params.query.length > 0,
  });
}

export function useAiHybridSearchQuery(params: AiSearchParams) {
  return useQuery({
    queryKey: ["ai-search", "hybrid", params],
    queryFn: () => hybridSearch(params),
    enabled: !!params.query && params.query.length > 0,
  });
}
```

### AI Search Component

```typescript
// apps/client/src/features/ai-search/components/ai-search-spotlight.tsx
import React, { useState } from "react";
import { Spotlight } from "@mantine/spotlight";
import { IconSearch, IconBrain } from "@tabler/icons-react";
import { useDebouncedValue } from "@mantine/hooks";
import { useAiSemanticSearchQuery } from "../queries/ai-search-query";

export function AiSearchSpotlight() {
  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebouncedValue(query, 300);

  const { data: results, isLoading } = useAiSemanticSearchQuery({
    query: debouncedQuery,
    limit: 10,
    similarity_threshold: 0.7,
  });

  return (
    <Spotlight.Root query={query} onQueryChange={setQuery}>
      <Spotlight.Search
        placeholder="AI-powered semantic search..."
        leftSection={<IconBrain size={20} />}
      />
      <Spotlight.ActionsList>
        {isLoading && <Spotlight.Empty>Searching...</Spotlight.Empty>}
        
        {!isLoading && (!results || results.length === 0) && (
          <Spotlight.Empty>No results found</Spotlight.Empty>
        )}

        {results?.map((result) => (
          <Spotlight.Action key={result.id}>
            <div>
              <div>{result.title}</div>
              <div style={{ fontSize: '0.8em', opacity: 0.7 }}>
                Similarity: {(result.similarity_score * 100).toFixed(1)}%
              </div>
              {result.highlight && (
                <div 
                  style={{ fontSize: '0.8em', opacity: 0.6 }}
                  dangerouslySetInnerHTML={{ __html: result.highlight }}
                />
              )}
            </div>
          </Spotlight.Action>
        ))}
      </Spotlight.ActionsList>
    </Spotlight.Root>
  );
}
```

## Search Mode Toggle

Create a component that allows users to choose between traditional and AI search:

```typescript
// apps/client/src/features/search/components/search-mode-toggle.tsx
import { SegmentedControl } from "@mantine/core";
import { IconSearch, IconBrain } from "@tabler/icons-react";

interface SearchModeToggleProps {
  value: 'traditional' | 'ai' | 'hybrid';
  onChange: (value: 'traditional' | 'ai' | 'hybrid') => void;
}

export function SearchModeToggle({ value, onChange }: SearchModeToggleProps) {
  return (
    <SegmentedControl
      value={value}
      onChange={onChange}
      data={[
        {
          label: 'Traditional',
          value: 'traditional',
          icon: IconSearch,
        },
        {
          label: 'AI Semantic',
          value: 'ai',
          icon: IconBrain,
        },
        {
          label: 'Hybrid',
          value: 'hybrid',
          icon: IconBrain,
        },
      ]}
    />
  );
}
```

## Performance Considerations

### Async Indexing

For better performance, consider making indexing asynchronous:

```typescript
// Use a queue for heavy indexing operations
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class PageService {
  constructor(
    @InjectQueue('ai-search') private aiSearchQueue: Queue,
  ) {}

  async createPage(createPageDto: CreatePageDto): Promise<Page> {
    const page = await this.pageRepo.create(createPageDto);
    
    // Queue indexing job instead of doing it synchronously
    await this.aiSearchQueue.add('index-page', {
      pageId: page.id,
      workspaceId: page.workspaceId,
      spaceId: page.spaceId,
      title: page.title,
      textContent: page.textContent,
    });

    return page;
  }
}
```

### Conditional Indexing

Only index pages when AI search is configured:

```typescript
async createPage(createPageDto: CreatePageDto): Promise<Page> {
  const page = await this.pageRepo.create(createPageDto);
  
      // Check if AI search is enabled before emitting events
    if (this.embeddingService.isConfigured()) {
    this.eventEmitter.emit('page.created', {
      pageId: page.id,
      workspaceId: page.workspaceId,
      spaceId: page.spaceId,
      title: page.title,
      textContent: page.textContent,
      operation: 'create'
    });
  }

  return page;
}
```

## Testing Integration

### Unit Tests

```typescript
// page.service.spec.ts
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('PageService', () => {
  let service: PageService;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PageService,
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PageService>(PageService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  it('should emit page.created event when creating page', async () => {
    const createPageDto = { title: 'Test Page', content: 'Test content' };
    await service.createPage(createPageDto);

    expect(eventEmitter.emit).toHaveBeenCalledWith('page.created', 
      expect.objectContaining({
        operation: 'create',
        title: 'Test Page',
      })
    );
  });
});
```

## Monitoring and Analytics

### Track Search Usage

```typescript
// Add search analytics
this.eventEmitter.emit('ai-search.query', {
  query: searchParams.query,
  userId: opts.userId,
  workspaceId: opts.workspaceId,
  searchType: 'semantic',
  resultCount: results.length,
  executionTime: Date.now() - startTime,
});
```

This integration approach ensures that your AI search stays in sync with your content while maintaining good performance and error handling. 