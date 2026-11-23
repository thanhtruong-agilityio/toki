import { useTranslation } from "@toki/i18n/react";
import { formatDateTime, type SessionItem } from "@toki/shared";
import { Button, useToasts } from "@toki/ui-web";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { sessions } from "../client";
import { ConfirmAction } from "../patterns";
import "./account.css";
import { browserKey, kindKey } from "./device-words";
import { useDateContext } from "./use-date-context";
import { useSignedInDevices } from "./use-devices";

type Ask =
  | { kind: "one"; id: string; description: string }
  | { kind: "others"; count: number };

// A 404 for an id that is not this person's session is a stale row only when
// the list read after it no longer holds the id (TOKI-026, "Outcomes").
const isNotFound = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  (error as { kind?: unknown }).kind === "http" &&
  (error as { status?: unknown }).status === 404;

// The whole section (R14 to R20): one row per device, a Sign out beside each
// other device and Sign out all other devices, each after a confirmation.
export function SignedInDevices() {
  const { t } = useTranslation();
  const toasts = useToasts();
  const ctx = useDateContext();
  const { status, devices, held, refreshing, reload } = useSignedInDevices();
  const [ask, setAsk] = useState<Ask | null>(null);
  const [busy, setBusy] = useState(false);
  const headRef = useRef<HTMLHeadingElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  // Set when a confirmation has been answered; read after the new list is drawn.
  const checkFocus = useRef<HTMLElement | null>(null);

  // The description of a row names the device and its last use; two rows with
  // the same description are told apart by their place among them (R15).
  const rows = useMemo(() => {
    const base = devices.map((device) => {
      const name = t("account.devices.row.name", {
        browser: t(browserKey(device.browser)),
        device: t(kindKey(device.deviceKind)),
      });
      const at = Date.parse(device.lastUsedAt);
      const time = Number.isNaN(at) ? null : formatDateTime(at, ctx);
      const description =
        time === null
          ? name
          : t("account.devices.row.described", { name, time });
      return { device, name, time, description };
    });
    const total = new Map<string, number>();
    for (const row of base) {
      total.set(row.description, (total.get(row.description) ?? 0) + 1);
    }
    const seen = new Map<string, number>();
    return base.map((row) => {
      const count = total.get(row.description) ?? 1;
      if (count === 1) return { ...row, label: row.description };
      const n = (seen.get(row.description) ?? 0) + 1;
      seen.set(row.description, n);
      return {
        ...row,
        label: t("account.devices.row.position", {
          description: row.description,
          n,
          count,
        }),
      };
    });
    // The date context holds `now`, which changes on every render: the rows
    // are rebuilt only when the list or the language changes.
  }, [devices, t, ctx.language, ctx.timeZone]);

  // R19: after the list was read again and drawn, when the button that opened
  // the dialog has left the document, focus goes to the heading.
  useLayoutEffect(() => {
    const opener = checkFocus.current;
    if (!opener) return;
    checkFocus.current = null;
    if (!opener.isConnected) headRef.current?.focus();
  }, [devices]);

  const fail = () => toasts.show({ text: t("common.error.actionFailed") });

  const finish = async (opener: HTMLElement | null) => {
    checkFocus.current = opener;
    const list = await reload();
    if (list === null) checkFocus.current = null;
    return list;
  };

  const confirm = async () => {
    if (!ask || busy) return;
    const opener = openerRef.current;
    setBusy(true);
    try {
      if (ask.kind === "one") {
        try {
          await sessions.endOne(ask.id);
        } catch (error) {
          if (!isNotFound(error)) throw error;
          // Stale only when the id is gone from the next list.
          const list = await finish(opener);
          if (list && !list.some((d) => d.id === ask.id)) {
            setAsk(null);
          } else {
            fail();
          }
          return;
        }
      } else {
        await sessions.endOthers();
      }
      setAsk(null);
      await finish(opener);
    } catch {
      // The dialog stays open: press again or cancel.
      fail();
    } finally {
      setBusy(false);
    }
  };

  const others = devices.filter((d) => !d.current).length;

  const pressOthers = async (opener: HTMLElement) => {
    // The count is what the server holds when the question is asked.
    const list = await reload();
    if (!list) return;
    const count = list.filter((d) => !d.current).length;
    if (count === 0) return;
    openerRef.current = opener;
    setAsk({ kind: "others", count });
  };

  return (
    <section>
      <h2 ref={headRef} className="devshead" tabIndex={-1}>
        {t("account.devices.title")}
      </h2>
      <div className="devs" aria-busy={refreshing ? "true" : undefined}>
        {status === "loading" && (
          <p className="muted">{t("account.devices.loading")}</p>
        )}
        {rows.map(({ device, name, time, label }) => (
          <Row
            key={device.id}
            device={device}
            name={name}
            time={time}
            label={label}
            onSignOut={(button) => {
              openerRef.current = button;
              setAsk({ kind: "one", id: device.id, description: label });
            }}
          />
        ))}
        {status === "failed" && (
          <div className="devfoot">
            <p>{t("account.devices.loadError")}</p>
            <Button size="sm" onClick={() => void reload()}>
              {t("account.devices.retry")}
            </Button>
          </div>
        )}
        {held && (
          <div className="devfoot">
            {others > 0 ? (
              <Button
                variant="danger"
                onClick={(event) => void pressOthers(event.currentTarget)}
              >
                {t("account.devices.signOutOthers")}
              </Button>
            ) : (
              <p className="muted">{t("account.devices.noOthers")}</p>
            )}
          </div>
        )}
      </div>
      {ask?.kind === "one" && (
        <ConfirmAction
          action="signOutDevice"
          open
          variant="danger"
          title={t("account.devices.confirmOne.title")}
          description={t("account.devices.confirmOne.description")}
          target={ask.description}
          confirmLabel={t("account.devices.signOut")}
          busy={busy}
          returnFocusRef={openerRef}
          onConfirm={() => void confirm()}
          onCancel={() => setAsk(null)}
        />
      )}
      {ask?.kind === "others" && (
        <ConfirmAction
          action="signOutOtherDevices"
          open
          variant="danger"
          title={t("account.devices.confirmAll.title")}
          description={t("account.devices.confirmAll.description", {
            count: ask.count,
          })}
          target={t("account.devices.confirmAll.target", { count: ask.count })}
          confirmLabel={t("account.devices.signOutOthers")}
          busy={busy}
          returnFocusRef={openerRef}
          onConfirm={() => void confirm()}
          onCancel={() => setAsk(null)}
        />
      )}
    </section>
  );
}

function Row({
  device,
  name,
  time,
  label,
  onSignOut,
}: {
  device: SessionItem;
  name: string;
  time: string | null;
  label: string;
  onSignOut: (button: HTMLElement) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="devrow">
      <div className="devname">
        <span className="devtitle">{name}</span>
        {device.current && (
          <span className="devnow">{t("account.devices.thisDevice")}</span>
        )}
        {time !== null && (
          <div className="xs muted">
            {t("account.devices.lastUsed", { time })}
          </div>
        )}
      </div>
      {!device.current && (
        <Button
          size="sm"
          aria-label={t("account.devices.signOutLabel", { device: label })}
          onClick={(event) => onSignOut(event.currentTarget)}
        >
          {t("account.devices.signOut")}
        </Button>
      )}
    </div>
  );
}
