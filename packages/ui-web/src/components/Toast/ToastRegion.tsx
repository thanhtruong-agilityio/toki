import {
  forwardRef,
  useLayoutEffect,
  useState,
  type ComponentPropsWithoutRef,
} from "react";
import { cx } from "../../internal/cx";
import { Toast } from "./Toast";
import { useToastList } from "./ToastProvider";
import { computeToastBottom, computeToastExtent } from "./toastPlace";
import "./Toast.css";

export type ToastRegionProps = Omit<
  ComponentPropsWithoutRef<"div">,
  "aria-live" | "children"
>;

// The one live region of the toasts (R19, R21). It is in the document from
// the first render, so that a screen reader announces a toast added later.
export const ToastRegion = forwardRef<HTMLDivElement, ToastRegionProps>(
  function ToastRegion({ className, style, ...rest }, ref) {
    const { items, api, hold, registry } = useToastList();
    const [place, setPlace] = useState<Place>({ bottom: 20 });

    // Measures what the layout registered and sets the region's place (R28,
    // R31): when something is registered or removed, changes size or ends a
    // transition (through the registry), when the window is resized, and
    // when a toast is added or removed.
    useLayoutEffect(() => {
      const measure = () =>
        setPlace((now) => keep(now, measurePlace(registry)));
      measure();
      const stop = registry.subscribe(measure);
      window.addEventListener("resize", measure);
      return () => {
        stop();
        window.removeEventListener("resize", measure);
      };
    }, [registry]);
    useLayoutEffect(() => {
      setPlace((now) => keep(now, measurePlace(registry)));
    }, [registry, items]);

    const {
      "aria-live": _live,
      children: _children,
      ...others
    } = rest as typeof rest & Record<string, unknown>;
    void [_live, _children];
    return (
      <div
        {...others}
        ref={ref}
        className={cx("toasts", className)}
        style={{
          ...style,
          bottom: place.bottom,
          ...(place.left === undefined
            ? {}
            : { left: place.left, width: place.width }),
        }}
        aria-live="polite"
      >
        {items.map((item) => (
          <Toast
            key={item.id}
            text={item.text}
            action={
              item.action && {
                label: item.action.label,
                // The toast goes first, then the caller's code (R24).
                onPress: () => {
                  api.dismiss(item.id);
                  item.action!.onPress();
                },
              }
            }
            onPointerEnter={() => hold(item.id, "pointer", true)}
            onPointerLeave={() => hold(item.id, "pointer", false)}
            onFocus={() => hold(item.id, "focus", true)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                hold(item.id, "focus", false);
              }
            }}
          />
        ))}
      </div>
    );
  },
);

type Place = { bottom: number; left?: number; width?: number };
type RegistryRead = ReturnType<
  ReturnType<typeof useToastList>["registry"]["read"]
>;

const rectOf = (ref: RegistryRead["avoid"][number]) => {
  const el = ref.current;
  if (!el || !el.isConnected) return undefined;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 ? rect : undefined;
};

function measurePlace(
  registry: ReturnType<typeof useToastList>["registry"],
): Place {
  const { avoid, anchors } = registry.read();
  let anchor: { left: number; right: number } | undefined;
  for (let i = anchors.length - 1; i >= 0 && !anchor; i -= 1) {
    const rect = rectOf(anchors[i]!);
    if (rect) anchor = { left: rect.left, right: rect.right };
  }
  const extent = computeToastExtent(window.innerWidth, anchor);
  const obstacles = avoid.flatMap((ref) => {
    const rect = rectOf(ref);
    return rect ? [{ top: rect.top, left: rect.left, right: rect.right }] : [];
  });
  const bottom = computeToastBottom(window.innerHeight, obstacles, {
    left: extent.left,
    right: extent.left + extent.width,
  });
  return anchor
    ? { bottom, left: extent.left + extent.width / 2, width: extent.width }
    : { bottom };
}

// The same place gives the same object, so React does not render again.
function keep(now: Place, next: Place): Place {
  return now.bottom === next.bottom &&
    now.left === next.left &&
    now.width === next.width
    ? now
    : next;
}
