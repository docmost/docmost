import { getMimeType } from '../../common/helpers';
import { inlineFileExtensions } from './attachment.constants';

/**
 * Security regression tests for stored XSS via MIME type spoofing.
 *
 * The vulnerability: a client uploads a file named "malicious.jpg" with
 * Content-Type: text/html in the multipart header. If the server stores
 * and serves the client-provided MIME type instead of deriving it from
 * the file extension, the browser renders attacker-controlled HTML/JS
 * in the application's origin.
 *
 * The fix: sendFileResponse derives Content-Type from the file extension
 * via getMimeType(), never trusting the stored attachment.mimeType.
 */
describe('Attachment MIME type security', () => {
  describe('getMimeType derives safe Content-Type from file extension', () => {
    it('should return image/jpeg for .jpg files regardless of stored mimeType', () => {
      const result = getMimeType('malicious.jpg');
      expect(result).toMatch(/^image\/jpeg/);
      expect(result).not.toBe('text/html');
    });

    it('should return image/png for .png files regardless of stored mimeType', () => {
      const result = getMimeType('malicious.png');
      expect(result).toMatch(/^image\/png/);
      expect(result).not.toBe('text/html');
    });

    it('should return image/jpeg for .jpeg files', () => {
      const result = getMimeType('photo.jpeg');
      expect(result).toMatch(/^image\/jpeg/);
    });

    it('should return application/pdf for .pdf files', () => {
      const result = getMimeType('document.pdf');
      expect(result).toMatch(/^application\/pdf/);
    });

    it('should return video/mp4 for .mp4 files', () => {
      const result = getMimeType('video.mp4');
      expect(result).toMatch(/^video\/mp4/);
    });

    it('should return application/octet-stream for unknown extensions', () => {
      const result = getMimeType('file.xyz123');
      expect(result).toBe('application/octet-stream');
    });
  });

  describe('inline file extensions only contain safe types', () => {
    it('should not include any script-executable extensions', () => {
      const dangerousExtensions = [
        '.html',
        '.htm',
        '.xhtml',
        '.svg',
        '.xml',
        '.xsl',
        '.js',
        '.mjs',
        '.css',
      ];
      for (const ext of dangerousExtensions) {
        expect(inlineFileExtensions).not.toContain(ext);
      }
    });

    it('should only contain known safe media extensions', () => {
      const safeExtensions = ['.jpg', '.png', '.jpeg', '.pdf', '.mp4', '.mov'];
      expect(inlineFileExtensions).toEqual(safeExtensions);
    });
  });

  describe('getMimeType never returns text/html for inline extensions', () => {
    it.each(inlineFileExtensions)(
      'extension %s should not resolve to text/html',
      (ext) => {
        const mimeType = getMimeType(`file${ext}`);
        expect(mimeType).not.toMatch(/^text\/html/);
        expect(mimeType).not.toMatch(/^application\/xhtml/);
        expect(mimeType).not.toMatch(/^image\/svg/);
      },
    );
  });
});
