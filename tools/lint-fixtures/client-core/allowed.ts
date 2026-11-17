// Fixture for rule 1: everything here is allowed, so no line may be reported.
// It uses every global of the allow list.
import "react";
import "@toki/shared";
import "./violates";

export const timers = [
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  queueMicrotask,
];
export const network = [
  fetch,
  Headers,
  Request,
  Response,
  WebSocket,
  URL,
  URLSearchParams,
  AbortController,
  AbortSignal,
];
export const builtIns = [Map, Set, Promise, JSON, Math, Intl, Symbol, WeakRef];
console.log("allowed");

export type Loaded = Promise<Record<string, Response>>;
export type Timer = ReturnType<typeof setTimeout>;
export const lazy = () => import("@toki/i18n");

// The types that go with the allowed globals, and any other type that is not
// one of the banned DOM type names (Window, Document, Element, HTML*, SVG*):
// a type alone does not load the browser. They rely on review.
export type Options = RequestInit & { headers: HeadersInit; body: BodyInit };
export type Incoming = MessageEvent | CloseEvent | Event;
export type Unrelated = Storage;

// A local name that shadows a browser global is not the global.
export function open(window: { title: string }, document: string) {
  return window.title + document;
}
