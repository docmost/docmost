import { collapseBlankLines, stripLinks } from './text.utils';

describe('collapseBlankLines', () => {
  it.each([
    ['a\n\n\n\nb', 'a\n\nb'],
    ['a\n\nb', 'a\n\nb'],
    ['a\nb', 'a\nb'],
    ['\n\n\n\na\n\n\n', '\n\na\n\n'],
    ['no newlines', 'no newlines'],
    ['', ''],
  ])('collapses %j to %j', (input, expected) => {
    expect(collapseBlankLines(input)).toBe(expected);
  });
});

describe('stripLinks', () => {
  it.each([
    ['Visit https://evil.com/login now', 'Visit  now'],
    ['HTTPS://EVIL.COM', ''],
    ['go to www.evil.com today', 'go to  today'],
    ['www.intranet', ''],
    ['see evil.com/reset, then sign in', 'see , then sign in'],
    ['sub.evil.co.uk', ''],
    ['evil.com?x=1#y', ''],
    ['mail alice@acme.com or mailto:bob@acme.com', 'mail  or '],
    ['ftp://files.example.com/a and ssh://host.internal', ' and '],
    ['(evil.com)', '()'],
    ['evil.com.', '.'],
    ['localhost:3000/admin', ''],
    ['http://192.168.0.1/admin', ''],
    ["<a href='https://evil.com'>click</a>", "<a href='"],
    [
      '大家好！请先阅读https://docs.example.com里的指南，谢谢！',
      '大家好！请先阅读里的指南，谢谢！',
    ],
    [
      '大家好！请先阅读docs.example.com里的指南。',
      '大家好！请先阅读里的指南。',
    ],
    [
      'みなさん、https://docs.example.com/guideを読んでください。',
      'みなさん、を読んでください。',
    ],
    ['evilhttps://a.io.com', ''],
    ['Q4 docs, node.js and v1.2.3', 'Q4 docs, node.js and v1.2.3'],
    [
      'Hey team, join our workspace so we can move the Q4 docs out of email.',
      'Hey team, join our workspace so we can move the Q4 docs out of email.',
    ],
    ['请用Docmost查看docs.example.com的指南', '请用Docmost查看的指南'],
    ['请把Q4的PDF上传到docs.example.com', '请把Q4的PDF上传到'],
    ['APIの仕様はdocs.example.comにあります', 'APIの仕様はにあります'],
    ['在GitHub上看github.com/org/repo吧', '在GitHub上看吧'],
    ['请看https://example.com/guide里的Docmost说明', '请看里的Docmost说明'],
    ['😀 evil.com tail', '😀  tail'],
    ['localhost', ''],
    ['docmost-login.xn--80asehdb/reset', ''],
    ['LOGIN.XN--P1AI', ''],
    ['192.168.0.1/admin', ''],
    ['see 10.0.0.1:8080 now', 'see  now'],
    ['version 1.2.3 and 2.0', 'version 1.2.3 and 2.0'],
    ['evil\u00AD.com', ''],
    ['evil\u200B.com', ''],
    ['\u202Emoc.lieve', 'moc.lieve'],
    ['family \u{1F468}\u200D\u{1F469}\u200D\u{1F467} ok', 'family \u{1F468}\u200D\u{1F469}\u200D\u{1F467} ok'],
  ])('strips links from %j to %j', (input, expected) => {
    expect(stripLinks(input)).toBe(expected);
  });
});
