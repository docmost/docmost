import { ConflictException, Injectable, NestMiddleware } from '@nestjs/common';
import {
  EDITOR_SCHEMA_HEADER,
  supportsTemplatePlaceholders,
} from '@docmost/editor-ext';
import type { JSONContent } from '@tiptap/core';
import type { IncomingMessage, ServerResponse } from 'http';
import { ClsService } from 'nestjs-cls';

export const LEGACY_TEMPLATE_EDITOR = 'legacyTemplateEditor';
export type LegacyTemplateOperation = 'preview' | 'apply';

export function templateReloadRequired() {
  return new ConflictException(
    'Reload Docmost to edit or apply this template with placeholders.',
  );
}

// Old Tiptap schemas discard a whole JSON document when any one node is
// unknown. Give those editors a compatible preview and guard writes separately.
export function legacyTemplateContent(
  doc: JSONContent,
  operation: LegacyTemplateOperation,
): JSONContent {
  if (!doc.content) return doc;
  let changed = false;
  const content: JSONContent[] = [];
  for (const node of doc.content) {
    if (node.type === 'templatePlaceholder') {
      if (operation === 'apply') throw templateReloadRequired();
      changed = true;
      continue;
    }
    const child = legacyTemplateContent(node, operation);
    changed ||= child !== node;
    content.push(child);
  }
  return changed ? { ...doc, content } : doc;
}

@Injectable()
export class TemplateEditorMiddleware implements NestMiddleware {
  constructor(private readonly cls: ClsService) {}

  use(
    req: IncomingMessage & { originalUrl?: string },
    _res: ServerResponse,
    next: () => void,
  ) {
    if (!supportsTemplatePlaceholders(req.headers[EDITOR_SCHEMA_HEADER])) {
      const pathname = new URL(req.originalUrl ?? req.url, 'http://localhost')
        .pathname;
      const operation: LegacyTemplateOperation = /\/(apply|use)\/?$/.test(
        pathname,
      )
        ? 'apply'
        : 'preview';
      this.cls.set(LEGACY_TEMPLATE_EDITOR, operation);
    }
    next();
  }
}
