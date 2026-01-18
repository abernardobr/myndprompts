import { boot } from 'quasar/wrappers';
import { createI18n } from 'vue-i18n';
import messages from '@/i18n';

export type MessageLanguages = keyof typeof messages;
export type MessageSchema = (typeof messages)['en-US'];

declare module 'vue-i18n' {
  export interface DefineLocaleMessage extends MessageSchema {}
  export interface DefineDateTimeFormat {}
  export interface DefineNumberFormat {}
}

const i18n = createI18n<[MessageSchema], MessageLanguages>({
  locale: 'en-US',
  fallbackLocale: 'en-US',
  legacy: false,
  messages,
});

export default boot(({ app }) => {
  app.use(i18n);
});

export { i18n };
