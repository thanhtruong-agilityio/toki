import type { SessionItem } from "@toki/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { sessions } from "../client";

export type DevicesStatus = "loading" | "ready" | "failed";

type State = {
  devices: SessionItem[] | null;
  error: boolean;
  refreshing: boolean;
};

// The list of the person's own sessions (R14). It is read when the section
// mounts and again on `reload()`. A reload keeps the last list on screen and
// marks it busy; a failed one keeps the rows and flags the error. An answer to
// a read that began before a later one is ignored, so an old list never
// replaces a new one. `reload()` resolves with the list it read, or `null`
// when the read failed or was replaced.
export function useSignedInDevices() {
  const [state, setState] = useState<State>({
    devices: null,
    error: false,
    refreshing: true,
  });
  const latest = useRef(0);
  const alive = useRef(true);

  const reload = useCallback(async (): Promise<SessionItem[] | null> => {
    const mine = ++latest.current;
    setState((s) => ({ ...s, refreshing: true }));
    try {
      const devices = await sessions.list();
      if (!alive.current || mine !== latest.current) return null;
      setState({ devices, error: false, refreshing: false });
      return devices;
    } catch {
      if (!alive.current || mine !== latest.current) return null;
      setState((s) => ({ ...s, error: true, refreshing: false }));
      return null;
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void reload();
    return () => {
      alive.current = false;
    };
  }, [reload]);

  const status: DevicesStatus = state.error
    ? "failed"
    : state.devices === null
      ? "loading"
      : "ready";
  return {
    status,
    devices: state.devices ?? [],
    held: state.devices !== null,
    refreshing: state.refreshing,
    reload,
  };
}
