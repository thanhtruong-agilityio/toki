// Fixture for rule 3: ui-web reaches the notification, storage, service worker
// and audio APIs only through the platform package (R9). Every marked line
// must be reported.

// A bare name.
export const a1 = Notification; // expect: no-restricted-globals
export const a2 = localStorage; // expect: no-restricted-globals
export const a3 = sessionStorage; // expect: no-restricted-globals
export const a4 = indexedDB; // expect: no-restricted-globals
export const a5 = Audio; // expect: no-restricted-globals
export const a6 = AudioContext; // expect: no-restricted-globals
export const a7 = caches; // expect: no-restricted-globals
export const a8 = navigator.serviceWorker; // expect: no-restricted-properties
export const a9 = document.cookie; // expect: no-restricted-properties
export const a10 = typeof Notification; // expect: no-restricted-globals

// Through window.
export const b1 = window.Notification; // expect: no-restricted-properties
export const b2 = window.localStorage; // expect: no-restricted-properties
export const b3 = window.sessionStorage; // expect: no-restricted-properties
export const b4 = window.indexedDB; // expect: no-restricted-properties
export const b5 = window.Audio; // expect: no-restricted-properties
export const b6 = window.AudioContext; // expect: no-restricted-properties
export const b7 = window.caches; // expect: no-restricted-properties
export const b8 = window.navigator.serviceWorker; // expect: no-restricted-syntax
export const b9 = window.document.cookie; // expect: no-restricted-syntax

// Through globalThis.
export const c1 = globalThis.Notification; // expect: no-restricted-properties
export const c2 = globalThis.localStorage; // expect: no-restricted-properties
export const c3 = globalThis.sessionStorage; // expect: no-restricted-properties
export const c4 = globalThis.indexedDB; // expect: no-restricted-properties
export const c5 = globalThis.Audio; // expect: no-restricted-properties
export const c6 = globalThis.AudioContext; // expect: no-restricted-properties
export const c7 = globalThis.caches; // expect: no-restricted-properties
export const c8 = globalThis.navigator.serviceWorker; // expect: no-restricted-syntax
export const c9 = globalThis.document.cookie; // expect: no-restricted-syntax

// Through self.
export const d1 = self.Notification; // expect: no-restricted-properties
export const d2 = self.localStorage; // expect: no-restricted-properties
export const d3 = self.sessionStorage; // expect: no-restricted-properties
export const d4 = self.indexedDB; // expect: no-restricted-properties
export const d5 = self.Audio; // expect: no-restricted-properties
export const d6 = self.AudioContext; // expect: no-restricted-properties
export const d7 = self.caches; // expect: no-restricted-properties
export const d8 = self.navigator.serviceWorker; // expect: no-restricted-syntax
export const d9 = self.document.cookie; // expect: no-restricted-syntax
export const b10 = window["localStorage"]; // expect: no-restricted-properties

// By destructuring window.
export const { Notification: e1 } = window; // expect: no-restricted-properties
export const { localStorage: e2 } = window; // expect: no-restricted-properties
export const { sessionStorage: e3 } = window; // expect: no-restricted-properties
export const { indexedDB: e4 } = window; // expect: no-restricted-properties
export const { Audio: e5 } = window; // expect: no-restricted-properties
export const { AudioContext: e6 } = window; // expect: no-restricted-properties
export const { caches: e7 } = window; // expect: no-restricted-properties
export const { serviceWorker: e8 } = window.navigator; // expect: no-restricted-syntax
export const { cookie: e9 } = window.document; // expect: no-restricted-syntax
// prettier-ignore
export const { navigator: { serviceWorker: e10 } } = window; // expect: no-restricted-syntax
// prettier-ignore
export const { document: { cookie: e11 } } = window; // expect: no-restricted-syntax

// By destructuring globalThis.
export const { Notification: e12 } = globalThis; // expect: no-restricted-properties
export const { localStorage: e13 } = globalThis; // expect: no-restricted-properties
export const { sessionStorage: e14 } = globalThis; // expect: no-restricted-properties
export const { indexedDB: e15 } = globalThis; // expect: no-restricted-properties
export const { Audio: e16 } = globalThis; // expect: no-restricted-properties
export const { AudioContext: e17 } = globalThis; // expect: no-restricted-properties
export const { caches: e18 } = globalThis; // expect: no-restricted-properties
export const { serviceWorker: e19 } = globalThis.navigator; // expect: no-restricted-syntax
export const { cookie: e20 } = globalThis.document; // expect: no-restricted-syntax
// prettier-ignore
export const { navigator: { serviceWorker: e21 } } = globalThis; // expect: no-restricted-syntax
// prettier-ignore
export const { document: { cookie: e22 } } = globalThis; // expect: no-restricted-syntax

// By destructuring self.
export const { Notification: e23 } = self; // expect: no-restricted-properties
export const { localStorage: e24 } = self; // expect: no-restricted-properties
export const { sessionStorage: e25 } = self; // expect: no-restricted-properties
export const { indexedDB: e26 } = self; // expect: no-restricted-properties
export const { Audio: e27 } = self; // expect: no-restricted-properties
export const { AudioContext: e28 } = self; // expect: no-restricted-properties
export const { caches: e29 } = self; // expect: no-restricted-properties
export const { serviceWorker: e30 } = self.navigator; // expect: no-restricted-syntax
export const { cookie: e31 } = self.document; // expect: no-restricted-syntax
// prettier-ignore
export const { navigator: { serviceWorker: e32 } } = self; // expect: no-restricted-syntax
// prettier-ignore
export const { document: { cookie: e33 } } = self; // expect: no-restricted-syntax

// By destructuring navigator or document.
export const { serviceWorker: f1 } = navigator; // expect: no-restricted-properties
export const { cookie: f2 } = document; // expect: no-restricted-properties

// The audio element.
export const G1 = () => <audio src="a.mp3" />; // expect: no-restricted-syntax
export const G2 = () => <audio></audio>; // expect: no-restricted-syntax

// A comment cannot switch the rule off (R16).
// expect-next: inline-config
// eslint-disable-next-line no-restricted-globals
export const h1 = localStorage; // expect: no-restricted-globals
