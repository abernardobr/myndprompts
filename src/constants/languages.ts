/**
 * Language constants for snippet and plugin filtering
 * These are HUMAN languages (English, French, etc.), not programming languages
 */

// Human languages for content filtering
export const CONTENT_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'nl', label: 'Dutch' },
  { value: 'ru', label: 'Russian' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'ar', label: 'Arabic' },
  { value: 'hi', label: 'Hindi' },
  { value: 'tr', label: 'Turkish' },
  { value: 'pl', label: 'Polish' },
  { value: 'sv', label: 'Swedish' },
  { value: 'da', label: 'Danish' },
  { value: 'no', label: 'Norwegian' },
  { value: 'fi', label: 'Finnish' },
  { value: 'cs', label: 'Czech' },
  { value: 'el', label: 'Greek' },
  { value: 'he', label: 'Hebrew' },
  { value: 'th', label: 'Thai' },
  { value: 'vi', label: 'Vietnamese' },
  { value: 'id', label: 'Indonesian' },
  { value: 'ms', label: 'Malay' },
  { value: 'uk', label: 'Ukrainian' },
  { value: 'ro', label: 'Romanian' },
  { value: 'hu', label: 'Hungarian' },
  { value: 'bg', label: 'Bulgarian' },
] as const;

export type ContentLanguage = (typeof CONTENT_LANGUAGES)[number]['value'];

/**
 * Get display label for a language value
 */
export function getLanguageLabel(value: string): string {
  const lang = CONTENT_LANGUAGES.find((l) => l.value === value);
  return lang?.label ?? value;
}

/**
 * Get language options for select dropdowns (sorted alphabetically by label)
 */
export function getLanguageOptions(): { value: string; label: string }[] {
  return [...CONTENT_LANGUAGES].sort((a, b) => a.label.localeCompare(b.label));
}
