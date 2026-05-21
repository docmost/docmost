import { inlineFileExtensions, validImageExtensions } from './attachment.constants';

describe('AttachmentConstants', () => {
  describe('inlineFileExtensions', () => {
    it('should include standard image formats', () => {
      expect(inlineFileExtensions).toContain('.jpg');
      expect(inlineFileExtensions).toContain('.jpeg');
      expect(inlineFileExtensions).toContain('.png');
    });

    it('should include HEIC/HEIF for iOS support', () => {
      expect(inlineFileExtensions).toContain('.heic');
      expect(inlineFileExtensions).toContain('.heif');
    });

    it('should include document and media formats', () => {
      expect(inlineFileExtensions).toContain('.pdf');
      expect(inlineFileExtensions).toContain('.mp4');
      expect(inlineFileExtensions).toContain('.mov');
      expect(inlineFileExtensions).toContain('.mp3');
      expect(inlineFileExtensions).toContain('.wav');
      expect(inlineFileExtensions).toContain('.ogg');
      expect(inlineFileExtensions).toContain('.m4a');
      expect(inlineFileExtensions).toContain('.webm');
    });
  });

  describe('validImageExtensions', () => {
    it('should contain allowed image extensions for avatars/icons', () => {
      expect(validImageExtensions).toContain('.jpg');
      expect(validImageExtensions).toContain('.jpeg');
      expect(validImageExtensions).toContain('.png');
    });
  });
});
