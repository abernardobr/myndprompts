import { boot } from 'quasar/wrappers';
import { createI18n } from 'vue-i18n';
import type { Ref } from 'vue';
import messages from '@/i18n';

export type MessageLanguages = keyof typeof messages;
export type MessageSchema = (typeof messages)['en-US'];

// Available locales for validation
export const availableLocales: MessageLanguages[] = [
  'en-US',
  'en-GB',
  'en-IE',
  'pt-BR',
  'pt-PT',
  'es-ES',
  'fr-FR',
  'de-DE',
  'it-IT',
  'ar-SA',
];

declare module 'vue-i18n' {
  export interface DefineLocaleMessage extends MessageSchema {}
  export interface DefineDateTimeFormat {}
  export interface DefineNumberFormat {}
}

const i18n = createI18n({
  locale: 'en-US',
  fallbackLocale: 'en-US',
  legacy: false,
  globalInjection: true,
  missingWarn: false,
  fallbackWarn: false,
  messages,
});

/**
 * Set the application locale
 * Call this from uiStore after loading persisted locale from IndexedDB
 */
export function setAppLocale(locale: string): void {
  if (availableLocales.includes(locale as MessageLanguages)) {
    (i18n.global.locale as unknown as Ref<string>).value = locale;
  }
}

/**
 * Get the current application locale
 */
export function getAppLocale(): string {
  return (i18n.global.locale as unknown as Ref<string>).value;
}

export default boot(({ app }) => {
  app.use(i18n);
});

export { i18n };
