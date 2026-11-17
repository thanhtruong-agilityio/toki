// Fixture for R16: no comment can switch a boundary rule off or declare an
// extra global. Each comment is reported ("inline-config") and the violation
// it tried to hide is reported too.

// expect-next: inline-config
// eslint-disable-next-line toki/client-core-globals
export const a = window; // expect: toki/client-core-globals

// expect-next: toki/client-core-globals, inline-config
export const b = document; // eslint-disable-line toki/client-core-globals

// expect-next: inline-config
/* eslint toki/client-core-globals: off */
export const c = navigator; // expect: toki/client-core-globals

// expect-next: inline-config
/* global localStorage */
export const d = localStorage; // expect: toki/client-core-globals

// expect-next: inline-config
/* eslint-disable */
export const e = location; // expect: toki/client-core-globals
