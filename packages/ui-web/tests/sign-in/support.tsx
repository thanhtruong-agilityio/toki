import { act, render } from "@testing-library/react";
import { I18nProvider } from "@toki/i18n/react";
import type { Language } from "@toki/i18n";
import { createTestClock, type TestClock } from "@toki/shared";
import type { ReactElement } from "react";
import { SignInTimeProvider } from "../../src/sign-in/SignInTimeProvider";

// A `timers` object the test moves by hand. `advance` moves the test clock and
// runs every wake-up that falls due on the way, each inside act().
export function createFakeTimers(clock: TestClock) {
  type Item = { at: number; fn: () => void };
  let items: Item[] = [];
  return {
    after(ms: number, fn: () => void): () => void {
      const item = { at: clock.now() + ms, fn };
      items.push(item);
      return () => {
        items = items.filter((i) => i !== item);
      };
    },
    advance(ms: number): void {
      const target = clock.now() + ms;
      for (;;) {
        const due = items
          .filter((i) => i.at <= target)
          .sort((a, b) => a.at - b.at)[0];
        if (!due) break;
        items = items.filter((i) => i !== due);
        clock.set(Math.max(clock.now(), due.at));
        act(() => due.fn());
      }
      clock.set(target);
      act(() => {});
    },
    pending(): number {
      return items.length;
    },
  };
}

export function renderWithTime(
  ui: ReactElement,
  options: { language?: Language } = {},
) {
  const clock = createTestClock();
  const timers = createFakeTimers(clock);
  const result = render(
    <I18nProvider language={options.language ?? "en"}>
      <SignInTimeProvider clock={clock} timers={timers}>
        {ui}
      </SignInTimeProvider>
    </I18nProvider>,
  );
  return { ...result, clock, timers };
}

// A promise the test settles by hand: the answer of a request that is running.
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
