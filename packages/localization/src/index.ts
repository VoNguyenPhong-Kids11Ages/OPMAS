import en from '../../../locales/en.json';
import enUS from '../../../locales/en-US.json';
import vi from '../../../locales/vi.json';
import it from '../../../locales/it.json';
import sv from '../../../locales/sv.json';
import th from '../../../locales/th.json';

export type Messages = typeof en;
export const LOCALES = { en, 'en-US': enUS, vi, it, sv, th } as const;
export type LocaleCode = keyof typeof LOCALES;

export const isLocale = (code: string): code is LocaleCode => code in LOCALES;

export function createTranslator(code: string) {
  const messages: Messages = isLocale(code) ? LOCALES[code] : en;
  return {
    code: isLocale(code) ? code : 'en',
    t: <K extends keyof Messages>(key: K): Messages[K] => messages[key] ?? en[key],
  };
}
