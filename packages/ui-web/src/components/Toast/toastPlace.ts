// How long a toast stays (R23). There is no `duration` prop: the rule is here.
// 5 seconds with a button, D-069; 2.8 seconds without one, the prototype's.
export const TOAST_MS_WITH_ACTION = 5000;
export const TOAST_MS_PLAIN = 2800;

// At most this many toasts show at once; a new one removes the oldest (R25).
export const TOAST_MAX = 3;
