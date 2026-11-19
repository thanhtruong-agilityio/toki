// Types of check-fonts.mjs, for its tests (TOKI-010).

export interface Problem {
  file: string;
  requirement: string;
  message: string;
}

export interface FaceRow {
  family: string;
  weight: number;
  file: string;
}

export interface Declaration {
  property: string;
  value: string;
}

export interface ParsedCss {
  fontFaces: Declaration[][];
  rules: { selector: string; declarations: Declaration[] }[];
  atRules: string[];
}

export interface FontFacts {
  file: string;
  bytes: number;
  isWoff2: boolean;
  axes: string[];
  italic: boolean;
  weight: number;
  codePoints: Set<number>;
  sha256: string;
}

export interface SourceEntry {
  file: string;
  family: string;
  weight: number;
  upstream: string;
  version: string;
  licence: string;
  licenceFile: string;
  sha256: string;
  cut: {
    tool: string;
    toolVersion: string;
    command: string;
    unicodes: string;
    missing: string[];
  };
}

export interface NamedText {
  name: string;
  text: string;
}

export const TABLE_A: FaceRow[];
export const REQUIRED: number[];
export const TABLE_D: Record<string, number[]>;
export function isAllowed(codePoint: number): boolean;

export function parseCss(text: string): ParsedCss;
export function parseLinks(html: string): Record<string, string | true>[];

export function checkFileSet(input: {
  present: string[];
  tracked: string[];
}): Problem[];
export function checkFonts(input: {
  fonts: FontFacts[];
  sources: unknown;
}): Problem[];
export function checkCss(input: {
  css: string;
  importers: string[];
}): Problem[];
export function checkPreload(input: { html: string }): Problem[];
export function checkDist(input: {
  html: string;
  cssFiles: NamedText[];
  fileNames: string[];
  textFiles: { name: string; text: string | Uint8Array }[];
}): Problem[];
export function checkNoFontService(input: {
  files: { name: string; text: string | Uint8Array }[];
}): Problem[];
export function checkSources(input: {
  sources: unknown;
  fonts: FontFacts[];
  licenceFiles: string[];
}): Problem[];

export function readFont(path: string): Promise<FontFacts>;
export function formatProblem(problem: Problem): string;
export function findProblems(webDir: string): Promise<Problem[]>;
export function main(
  webDir: string,
  options?: { print?: (line: string) => void },
): Promise<number>;
