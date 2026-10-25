import * as React from 'react';
import * as enUS from './en-US.json';
import * as koKR from './ko-KR.json';
import { getEmailTranslator, normalizeEmailLocale } from './index';

const keysOf = (resource: object) =>
  Object.keys(resource).filter((key) => key !== 'default');

const placeholdersOf = (value: string) =>
  (value.match(/{{\s*\w+\s*}}/g) ?? []).sort();

describe('email i18n', () => {
  it('normalizes locales and falls back to en-US', () => {
    expect(normalizeEmailLocale(undefined)).toBe('en-US');
    expect(normalizeEmailLocale(null)).toBe('en-US');
    expect(normalizeEmailLocale('ko-KR')).toBe('ko-KR');
    expect(normalizeEmailLocale('ko')).toBe('ko-KR');
    expect(normalizeEmailLocale('ko_kr')).toBe('ko-KR');
    expect(normalizeEmailLocale('en-GB')).toBe('en-US');
    expect(normalizeEmailLocale('xx-YY')).toBe('en-US');
  });

  it('interpolates variables', () => {
    const { t } = getEmailTranslator('ko-KR');
    expect(
      t('pageMention.subject', { actorName: 'Kim', pageTitle: 'Doc' }),
    ).toBe('Kim님이 「Doc」에서 회원님을 언급했습니다');
    expect(getEmailTranslator().t('invitation.accept')).toBe('Accept Invite');
  });

  it('keeps unknown placeholders intact', () => {
    const { t } = getEmailTranslator('en-US');
    expect(t('pageMention.subject', { actorName: 'Kim' })).toBe(
      'Kim mentioned you in {{pageTitle}}',
    );
  });

  it('interpolates React nodes with rich()', () => {
    const { rich } = getEmailTranslator('en-US');
    const strong = React.createElement('strong', null, 'Kim');
    const element = rich('commentCreated.body', {
      actorName: strong,
      pageTitle: 'Doc',
    });
    expect(element.type).toBe(React.Fragment);
    expect((element.props as any).children).toEqual([
      strong,
      ' commented on ',
      'Doc',
      '.',
    ]);
  });

  it('has a ko-KR translation for every en-US key with the same placeholders', () => {
    const enKeys = keysOf(enUS);
    expect(keysOf(koKR).sort()).toEqual([...enKeys].sort());
    for (const key of enKeys) {
      expect([key, placeholdersOf(koKR[key])]).toEqual([
        key,
        placeholdersOf(enUS[key]),
      ]);
    }
  });
});
