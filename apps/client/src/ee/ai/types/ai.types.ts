export enum AiAction {
  IMPROVE_WRITING = "improve_writing",
  FIX_SPELLING_GRAMMAR = "fix_spelling_grammar",
  MAKE_SHORTER = "make_shorter",
  MAKE_LONGER = "make_longer",
  SIMPLIFY = "simplify",
  CHANGE_TONE = "change_tone",
  SUMMARIZE = "summarize",
  CONTINUE_WRITING = "continue_writing",
  TRANSLATE = "translate",
  CUSTOM = "custom",
}

export interface AiGenerateDto {
  action?: AiAction;
  content: string;
  prompt?: string;
}

export interface AiContentResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AiConfigResponse {
  configured: boolean;
  availableActions: AiAction[];
}

export interface AiStreamChunk {
  content: string;
}

export interface AiStreamError {
  error: string;
}
