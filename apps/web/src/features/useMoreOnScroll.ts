import { useCallback, useRef, type FocusEvent, type RefObject } from "react";

const THRESHOLD = 48;

type Options = {
  // Asks for more rows. The caller decides when there are none and when a page is on its way.
  onMore: () => void;
  // False while there is nothing more to ask or a page is already asked.
  enabled: boolean;
};

type Props = {
  ref: RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  onFocus: (event: FocusEvent<HTMLElement>) => void;
};

// More rows for a list that scrolls (TOKI-034 R8, R19): when the end of the container is within 48 px,
// or when focus enters its last row. Spread the result on the scrolling element.
export function useMoreOnScroll({ onMore, enabled }: Options): Props {
  const ref = useRef<HTMLDivElement | null>(null);
  const latest = useRef({ onMore, enabled });
  latest.current = { onMore, enabled };

  const onScroll = useCallback(() => {
    const el = ref.current;
    if (!el || !latest.current.enabled) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - THRESHOLD) {
      latest.current.onMore();
    }
  }, []);

  const onFocus = useCallback((event: FocusEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el || !latest.current.enabled) return;
    const rows = el.querySelectorAll("li");
    const last = rows.item(rows.length - 1);
    if (last && last.contains(event.target as Node)) latest.current.onMore();
  }, []);

  return { ref, onScroll, onFocus };
}
