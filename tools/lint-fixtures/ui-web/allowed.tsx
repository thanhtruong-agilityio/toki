// Fixture for rule 3: everything here is allowed (R10), so no line may be
// reported. The features are reached through the platform package.
import { audio, notifications, storage } from "@toki/platform";

export const saved = storage.get("draft");
export const ring = () => audio.play("timer-end");
export const ask = () => notifications.requestPermission();

// Browser APIs that are not platform features stay allowed in ui-web.
export const width = window.innerWidth;
export const language = navigator.language;
export const title = document.title;
export const Clip = () => <video src="a.mp4" />;

// A local name that shadows a banned global is not the global.
export function read(localStorage: { get(key: string): string }) {
  return localStorage.get("draft");
}
export function local(window: { localStorage: string }) {
  return window.localStorage;
}
export function worker(navigator: { serviceWorker: string }) {
  const { serviceWorker } = navigator;
  return navigator.serviceWorker + serviceWorker;
}

// A property of an unrelated object may have the name of a banned one.
type Shape = {
  document: { cookie: string };
  navigator: { serviceWorker: string };
};
export const fromProps = (props: Shape) => props.document.cookie;
export const fromNested = ({ navigator: { serviceWorker } }: Shape) =>
  serviceWorker;
export const fromObject = (shape: Shape) => {
  const {
    document: { cookie },
  } = shape;
  return cookie + shape.navigator.serviceWorker;
};
export const unrelated = (shape: { localStorage: string }) =>
  shape.localStorage;
export const { localStorage: fromOther } = { localStorage: "draft" };
export const deep = window.innerWidth + window.document.title.length;
export const sibling = window.navigator.language + document.title;
export const { title: heading, ...others } = document;

// A use in a type only is not a use of the API.
export type Sound = AudioContext | typeof others;
