import en from "./en";
import vi, { type Locale } from "./vi";

export type Lang = "vi" | "en";
export type { Locale };
export type Key = keyof Locale["text"];

const locales: Record<Lang, Locale> = { vi, en };

/** Everything shown to the user in one language: text, option lists, protocols, messages. */
export const loc = (lang: Lang): Locale => locales[lang];
export const t = (lang: Lang, k: Key): string => locales[lang].text[k];

/** Translate an engine/API message (written in English) into the chosen language. */
export function msg(text: string, lang: Lang): string {
  for (const [re, f] of locales[lang].messages) {
    const m = re.exec(text);
    if (m) return f(m);
  }
  return text;
}
