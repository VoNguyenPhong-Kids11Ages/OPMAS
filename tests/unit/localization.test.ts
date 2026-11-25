import { describe, expect, it } from 'vitest';
import { LOCALES, createTranslator } from '../../packages/localization/src/index.ts';

describe('localization', () => {
  it('has three safety warnings in every locale', () => {
    for (const msgs of Object.values(LOCALES)) expect(msgs.warnings).toHaveLength(3);
  });
  it('falls back to English for unknown codes', () => {
    expect(createTranslator('xx').t('close')).toBe('Close');
  });
});
