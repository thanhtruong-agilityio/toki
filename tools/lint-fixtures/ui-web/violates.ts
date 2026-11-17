// Fixture for rule 3: the cast that a .tsx file cannot hold. See violates.tsx.
export const a1 = (<Window>window).localStorage; // expect: toki/platform-apis
export const a2 = (<Navigator>navigator).serviceWorker; // expect: toki/platform-apis

// A type with the name of a global does not hide the global.
type navigator = { serviceWorker: string };
export const a3: navigator = navigator.serviceWorker; // expect: toki/platform-apis
