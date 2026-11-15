import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { LANGS, translations } from "./translations";
import { translationsExtra } from "./translations-extra";
import { translationsClient } from "./translations-client";
import { translationsRoles } from "./translations-roles";

// The extra catalogues carry corrected, workflow, client and role keys; they win over the base file.
[translationsExtra, translationsClient, translationsRoles].forEach((catalogue) => {
  Object.keys(catalogue).forEach((code) => {
    if (translations[code]) Object.assign(translations[code], catalogue[code]);
  });
});

const I18nContext = createContext(null);

const STORAGE_KEY = "speakup_lang";

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState("ru");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && translations[saved]) {
      setLangState(saved);
      document.documentElement.lang = saved;
      return undefined;
    }
    // Nothing chosen on this device yet: fall back to the language saved in the profile.
    let active = true;
    base44.auth
      .me()
      .then((user) => {
        const preferred = user?.language;
        if (active && preferred && translations[preferred]) {
          setLangState(preferred);
          document.documentElement.lang = preferred;
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const setLang = useCallback((next) => {
    if (!translations[next]) return;
    setLangState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.lang = next;
  }, []);

  const t = useCallback(
    (key, vars) => {
      let value = translations[lang]?.[key] ?? translations.ru[key] ?? key;
      if (vars) {
        Object.entries(vars).forEach(([k, v]) => {
          value = value.replaceAll(`{${k}}`, String(v));
        });
      }
      return value;
    },
    [lang]
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t, langs: LANGS }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  return {
    lang: "ru",
    setLang: () => {},
    langs: LANGS,
    t: (key) => translations.ru[key] ?? key,
  };
}
