// The only file of the package that imports React. Built with createElement, so the package
// needs no JSX setting. The provider holds no state: the caller owns the language (R11).
import {
  createContext,
  createElement,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { DEFAULT_LANGUAGE, type Language } from "./languages";
import { createTranslator, type Translator } from "./translate";

type Value = { language: Language; t: Translator };

const fallback: Value = {
  language: DEFAULT_LANGUAGE,
  t: createTranslator(DEFAULT_LANGUAGE),
};

const I18nContext = createContext<Value>(fallback);

export function I18nProvider(props: {
  language?: Language;
  children?: ReactNode;
}) {
  const language = props.language ?? DEFAULT_LANGUAGE;
  const value = useMemo<Value>(
    () => ({ language, t: createTranslator(language) }),
    [language],
  );
  return createElement(I18nContext.Provider, { value }, props.children);
}

export function useTranslation(): Value {
  return useContext(I18nContext);
}
