// Fixture for rule 3: ui-web reaches the notification, storage, service worker
// and audio APIs only through the platform package (R9). Every marked line
// must be reported.

// A bare name.
export const a1 = Notification; // expect: toki/platform-apis
export const a2 = localStorage; // expect: toki/platform-apis
export const a3 = sessionStorage; // expect: toki/platform-apis
export const a4 = indexedDB; // expect: toki/platform-apis
export const a5 = Audio; // expect: toki/platform-apis
export const a6 = AudioContext; // expect: toki/platform-apis
export const a7 = caches; // expect: toki/platform-apis
export const a8 = navigator.serviceWorker; // expect: toki/platform-apis
export const a9 = document.cookie; // expect: toki/platform-apis
export const a10 = typeof Notification; // expect: toki/platform-apis

// Through window.
export const b1 = window.Notification; // expect: toki/platform-apis
export const b2 = window.localStorage; // expect: toki/platform-apis
export const b3 = window.sessionStorage; // expect: toki/platform-apis
export const b4 = window.indexedDB; // expect: toki/platform-apis
export const b5 = window.Audio; // expect: toki/platform-apis
export const b6 = window.AudioContext; // expect: toki/platform-apis
export const b7 = window.caches; // expect: toki/platform-apis
export const b8 = window.navigator.serviceWorker; // expect: toki/platform-apis
export const b9 = window.document.cookie; // expect: toki/platform-apis

// Through globalThis.
export const c1 = globalThis.Notification; // expect: toki/platform-apis
export const c2 = globalThis.localStorage; // expect: toki/platform-apis
export const c3 = globalThis.sessionStorage; // expect: toki/platform-apis
export const c4 = globalThis.indexedDB; // expect: toki/platform-apis
export const c5 = globalThis.Audio; // expect: toki/platform-apis
export const c6 = globalThis.AudioContext; // expect: toki/platform-apis
export const c7 = globalThis.caches; // expect: toki/platform-apis
export const c8 = globalThis.navigator.serviceWorker; // expect: toki/platform-apis
export const c9 = globalThis.document.cookie; // expect: toki/platform-apis

// Through self.
export const d1 = self.Notification; // expect: toki/platform-apis
export const d2 = self.localStorage; // expect: toki/platform-apis
export const d3 = self.sessionStorage; // expect: toki/platform-apis
export const d4 = self.indexedDB; // expect: toki/platform-apis
export const d5 = self.Audio; // expect: toki/platform-apis
export const d6 = self.AudioContext; // expect: toki/platform-apis
export const d7 = self.caches; // expect: toki/platform-apis
export const d8 = self.navigator.serviceWorker; // expect: toki/platform-apis
export const d9 = self.document.cookie; // expect: toki/platform-apis
export const b10 = window["localStorage"]; // expect: toki/platform-apis

// By destructuring window.
export const { Notification: e1 } = window; // expect: toki/platform-apis
export const { localStorage: e2 } = window; // expect: toki/platform-apis
export const { sessionStorage: e3 } = window; // expect: toki/platform-apis
export const { indexedDB: e4 } = window; // expect: toki/platform-apis
export const { Audio: e5 } = window; // expect: toki/platform-apis
export const { AudioContext: e6 } = window; // expect: toki/platform-apis
export const { caches: e7 } = window; // expect: toki/platform-apis
export const { serviceWorker: e8 } = window.navigator; // expect: toki/platform-apis
export const { cookie: e9 } = window.document; // expect: toki/platform-apis
// prettier-ignore
export const { navigator: { serviceWorker: e10 } } = window; // expect: toki/platform-apis
// prettier-ignore
export const { document: { cookie: e11 } } = window; // expect: toki/platform-apis

// By destructuring globalThis.
export const { Notification: e12 } = globalThis; // expect: toki/platform-apis
export const { localStorage: e13 } = globalThis; // expect: toki/platform-apis
export const { sessionStorage: e14 } = globalThis; // expect: toki/platform-apis
export const { indexedDB: e15 } = globalThis; // expect: toki/platform-apis
export const { Audio: e16 } = globalThis; // expect: toki/platform-apis
export const { AudioContext: e17 } = globalThis; // expect: toki/platform-apis
export const { caches: e18 } = globalThis; // expect: toki/platform-apis
export const { serviceWorker: e19 } = globalThis.navigator; // expect: toki/platform-apis
export const { cookie: e20 } = globalThis.document; // expect: toki/platform-apis
// prettier-ignore
export const { navigator: { serviceWorker: e21 } } = globalThis; // expect: toki/platform-apis
// prettier-ignore
export const { document: { cookie: e22 } } = globalThis; // expect: toki/platform-apis

// By destructuring self.
export const { Notification: e23 } = self; // expect: toki/platform-apis
export const { localStorage: e24 } = self; // expect: toki/platform-apis
export const { sessionStorage: e25 } = self; // expect: toki/platform-apis
export const { indexedDB: e26 } = self; // expect: toki/platform-apis
export const { Audio: e27 } = self; // expect: toki/platform-apis
export const { AudioContext: e28 } = self; // expect: toki/platform-apis
export const { caches: e29 } = self; // expect: toki/platform-apis
export const { serviceWorker: e30 } = self.navigator; // expect: toki/platform-apis
export const { cookie: e31 } = self.document; // expect: toki/platform-apis
// prettier-ignore
export const { navigator: { serviceWorker: e32 } } = self; // expect: toki/platform-apis
// prettier-ignore
export const { document: { cookie: e33 } } = self; // expect: toki/platform-apis

// By destructuring navigator or document.
export const { serviceWorker: f1 } = navigator; // expect: toki/platform-apis
export const { cookie: f2 } = document; // expect: toki/platform-apis

// Through a TypeScript wrapper: a cast, a non-null assertion, `satisfies`.
export const i1 = (window as Window).Notification; // expect: toki/platform-apis
export const i2 = window!.Audio; // expect: toki/platform-apis
// prettier-ignore
export const i3 = (window as any).localStorage; // expect: toki/platform-apis, @typescript-eslint/no-explicit-any
// prettier-ignore
export const i4 = (navigator as any).serviceWorker; // expect: toki/platform-apis, @typescript-eslint/no-explicit-any
export const i5 = document!.cookie; // expect: toki/platform-apis
export const i6 = window.navigator!.serviceWorker; // expect: toki/platform-apis
export const i7 = (window satisfies Window).caches; // expect: toki/platform-apis
// prettier-ignore
export const i8 = (window?.navigator).serviceWorker; // expect: toki/platform-apis, no-unsafe-optional-chaining
export const i9 = window?.sessionStorage; // expect: toki/platform-apis

// By a computed name.
export const j1 = window.navigator["serviceWorker"]; // expect: toki/platform-apis
export const j2 = window["navigator"].serviceWorker; // expect: toki/platform-apis
export const j3 = window[`indexedDB`]; // expect: toki/platform-apis
export const j4 = document["cookie"]; // expect: toki/platform-apis
export const { ["localStorage"]: j5 } = window; // expect: toki/platform-apis

// Through window.window, self.self and the like.
export const k1 = window.window.localStorage; // expect: toki/platform-apis
export const k2 = globalThis.window.Notification; // expect: toki/platform-apis
export const k3 = self.self.AudioContext; // expect: toki/platform-apis
export const k4 = window.globalThis.document.cookie; // expect: toki/platform-apis
// prettier-ignore
export const { self: { caches: k5 } } = window; // expect: toki/platform-apis

// By destructuring in an assignment, a default value or behind a wrapper.
export let l1: unknown;
({ localStorage: l1 } = window); // expect: toki/platform-apis
export const l2 = ({ Audio: a } = window) => a; // expect: toki/platform-apis
export const { sessionStorage: l3 } = window as Window; // expect: toki/platform-apis
export const { serviceWorker: l4 } = navigator!; // expect: toki/platform-apis
const spare = { serviceWorker: null };
// prettier-ignore
export const { navigator: { serviceWorker: l5 } = spare } = window; // expect: toki/platform-apis
l1 = null;

// The audio element.
export const G1 = () => <audio src="a.mp3" />; // expect: no-restricted-syntax
export const G2 = () => <audio></audio>; // expect: no-restricted-syntax

// A comment cannot switch the rule off (R16).
// expect-next: inline-config
// eslint-disable-next-line toki/platform-apis
export const h1 = localStorage; // expect: toki/platform-apis
