import { extractMarkdownFrontMatter } from './import.utils';

describe('extractMarkdownFrontMatter', () => {
  it('returns empty object when input is empty or null', () => {
    expect(extractMarkdownFrontMatter('')).toEqual({});
    expect(extractMarkdownFrontMatter(null as any)).toEqual({});
    expect(extractMarkdownFrontMatter(undefined as any)).toEqual({});
  });

  it('returns empty object when there is no front matter', () => {
    const md = '# Title\n\nSome paragraph';
    expect(extractMarkdownFrontMatter(md)).toEqual({});
  });

  it('extracts title property from standard YAML front matter', () => {
    const md = `---
title: My Custom Page Title
author: Jane Doe
date: 2025-10-06
---

# Heading 1

Some content here.`;

    const result = extractMarkdownFrontMatter(md);
    expect(result.title).toBe('My Custom Page Title');
    expect(result.author).toBe('Jane Doe');
    expect(result.date).toBe('2025-10-06');
  });

  it('handles double and single quotes around property values', () => {
    const mdDouble = `---
title: "Wiki.js Exported Page Title"
---
# Heading`;

    const mdSingle = `---
title: 'Wiki.js Single Quoted Title'
---
# Heading`;

    expect(extractMarkdownFrontMatter(mdDouble).title).toBe(
      'Wiki.js Exported Page Title',
    );
    expect(extractMarkdownFrontMatter(mdSingle).title).toBe(
      'Wiki.js Single Quoted Title',
    );
  });

  it('handles front matter with whitespace and comments', () => {
    const md = `---
# Metadata comment
title: Note Title
# Another comment
description: Just a description
---
Body text`;

    const result = extractMarkdownFrontMatter(md);
    expect(result.title).toBe('Note Title');
    expect(result.description).toBe('Just a description');
  });

  it('does not extract front matter if not at the start of the file', () => {
    const md = `Some leading text
---
title: Should Not Match
---`;
    expect(extractMarkdownFrontMatter(md)).toEqual({});
  });
});
