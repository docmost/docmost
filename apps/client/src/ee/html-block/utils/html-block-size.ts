const KILOBYTE = 1024;
const MEGABYTE = 1024 * 1024;

export function formatHtmlBlockSize(bytes: number): string {
  const kilobytes = Math.ceil(bytes / KILOBYTE);
  if (kilobytes < KILOBYTE) return `${kilobytes} KB`;

  // rounded up so a size over the limit never reads as the limit itself
  const tenths = Math.ceil((bytes * 10) / MEGABYTE);
  return `${(tenths / 10).toFixed(1)} MB`;
}
