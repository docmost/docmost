import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsArray,
  IsBoolean,
} from 'class-validator';

export class SemanticSearchDto {
  @IsNotEmpty()
  @IsString()
  query: string;

  @IsOptional()
  @IsString()
  spaceId?: string;

  @IsOptional()
  @IsString()
  shareId?: string;

  @IsOptional()
  @IsString()
  creatorId?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number = 0;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  similarity_threshold?: number = 0.7;

  @IsOptional()
  @IsBoolean()
  include_highlights?: boolean = true;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  filters?: string[];
}

export class SemanticSearchShareDto extends SemanticSearchDto {
  @IsNotEmpty()
  @IsString()
  shareId: string;

  @IsOptional()
  @IsString()
  spaceId?: string;
}

export class SemanticSearchResponseDto {
  id: string;
  title: string;
  icon: string;
  parentPageId: string;
  creatorId: string;
  similarity_score: number;
  semantic_rank: number;
  highlight: string;
  createdAt: Date;
  updatedAt: Date;
  space?: {
    id: string;
    name: string;
    slug: string;
  };
}

export class HybridSearchResponseDto extends SemanticSearchResponseDto {
  text_rank?: number;
  combined_score: number;
  search_type: 'semantic' | 'text' | 'hybrid';
}

export class ReindexDto {
  @IsOptional()
  @IsString()
  spaceId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  pageIds?: string[];

  @IsNotEmpty()
  @IsString()
  workspaceId: string;
} 