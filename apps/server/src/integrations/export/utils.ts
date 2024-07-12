import { ExportFormat } from './dto/export-dto';

export function getExportExtension(format: string) {
  if (format === ExportFormat.HTML) {
    return '.html';
  }

  if (format === ExportFormat.Markdown) {
    return '.md';
  }
  return;
}
