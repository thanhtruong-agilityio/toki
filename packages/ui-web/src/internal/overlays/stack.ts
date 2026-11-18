import { useRef } from "react";

export type LayerKind = "dialog" | "menu";

export type Layer = {
  id: number;
  // Counter read at the first render with `open` true (R9), not the order of
  // the effects.
  order: number;
  kind: LayerKind;
  // Calls the latest onRequestClose or onClose of the layer.
  close: (reason: "escape") => void;
  // The element of the layer, so the trap can tell "inside a layer above" (R12).
  getNode: () => HTMLElement | null;
};

// The stack, the counter and the Esc listener are module-level: one copy of
// `@toki/ui-web` in a bundle is a requirement (R9).
let layers: Layer[] = [];
let counter = 0;
let ids = 0;
let listening = false;

export function nextOrder(): number {
  counter += 1;
  return counter;
}

export function newLayerId(): number {
  ids += 1;
  return ids;
}

// Reads the order of a layer at its first render with `open` true and clears
// it when `open` turns false (R9).
export function useLayerOrder(open: boolean): number {
  const order = useRef(0);
  if (!open) order.current = 0;
  else if (order.current === 0) order.current = nextOrder();
  return order.current;
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key !== "Escape") return;
  // An input method is composing; Safari reports the key that ends a
  // composition with keyCode 229 and isComposing false (R9).
  if (event.isComposing || event.keyCode === 229) return;
  const top = layers[layers.length - 1];
  if (!top) return;
  event.preventDefault();
  event.stopPropagation();
  top.close("escape");
}

function sync(): void {
  if (layers.length > 0 && !listening) {
    document.addEventListener("keydown", onKeyDown, true);
    listening = true;
  } else if (layers.length === 0 && listening) {
    document.removeEventListener("keydown", onKeyDown, true);
    listening = false;
  }
}

export function pushLayer(layer: Layer): void {
  layers = [...layers.filter((l) => l.id !== layer.id), layer].sort(
    (a, b) => a.order - b.order,
  );
  sync();
}

export function removeLayer(id: number): void {
  layers = layers.filter((l) => l.id !== id);
  sync();
}

export function isTop(id: number): boolean {
  return layers[layers.length - 1]?.id === id;
}

export function layersAbove(id: number): Layer[] {
  const index = layers.findIndex((l) => l.id === id);
  return index < 0 ? [] : layers.slice(index + 1);
}

export function layerCount(): number {
  return layers.length;
}

// Presses (pointerdown) that a Menu has used to close itself; the scrim of a
// dialog below ignores them (R10).
const handled = new WeakSet<Event>();

export function markPressHandled(event: Event): void {
  handled.add(event);
}

export function isPressHandled(event: Event): boolean {
  return handled.has(event);
}
