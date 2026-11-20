import { useTranslation } from "@toki/i18n/react";
import {
  CHANNEL_MEMBERS_ADD_MAX,
  CHANNEL_NAME_MAX,
  CHANNEL_TOPIC_MAX,
} from "@toki/shared";
import { Button, Field, Modal, Switch } from "@toki/ui-web";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { hasFormContent, useFormGuard, useOnlineGate } from "../../patterns";
import {
  normalizeChannelName,
  validateChannelName,
  validateChannelTopic,
} from "./channelName";
import {
  conversations,
  newId,
  PeoplePicker,
  personHue,
  useCurrentRole,
  useCurrentUserId,
  usePeople,
} from "./deps";
import { submitCreateChannel, type Attempt } from "./submitCreateChannel";
import "./createChannel.css";

export type CreateChannelDialogProps = {
  open: boolean;
  onClose: () => void;
  onOpenConversation: (id: string) => void;
  onCreated?: (id: string) => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
};

type Failure = "actionFailed" | "invalidMember" | null;

// The dialog renders nothing for a role that is not `admin` (R5, R18), and its
// state starts again at every opening: the inner component has a new key each
// time `open` turns true.
export function CreateChannelDialog(props: CreateChannelDialogProps) {
  const role = useCurrentRole();
  const [wasOpen, setWasOpen] = useState(props.open);
  const [session, setSession] = useState(0);
  if (props.open !== wasOpen) {
    setWasOpen(props.open);
    if (props.open) setSession(session + 1);
  }
  if (role !== "admin") return null;
  return <CreateChannelForm key={session} {...props} />;
}

function CreateChannelForm({
  open,
  onClose,
  onOpenConversation,
  onCreated,
  returnFocusRef,
}: CreateChannelDialogProps) {
  const { t } = useTranslation();
  const { ensureOnline } = useOnlineGate();
  const people = usePeople();
  const currentUserId = useCurrentUserId();

  // `nameText` is what the input holds: during an input method's composition it
  // is the browser's text, otherwise the normalised text (R6).
  const [nameText, setNameText] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [topic, setTopic] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [refusedName, setRefusedName] = useState<string | null>(null);
  const [failure, setFailure] = useState<Failure>(null);
  const [busy, setBusy] = useState(false);
  const [focusAsk, setFocusAsk] = useState<{
    to: "name" | "create";
    n: number;
  } | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const createRef = useRef<HTMLButtonElement>(null);
  const composing = useRef(false);
  const caret = useRef<number | null>(null);
  const attempt = useRef<Attempt>(null);
  const busyRef = useRef(false);
  const mounted = useRef(false);
  const privateLabelId = useId();
  const peopleLabelId = useId();

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const name = normalizeChannelName(nameText);
  const nameVerdict = validateChannelName(name);
  const topicVerdict = validateChannelTopic(topic);
  const nameTaken = refusedName !== null && name === refusedName;
  const canCreate =
    nameVerdict.valid && topicVerdict.valid && !nameTaken && !busy;

  // Puts the caret back where the person was typing (R6) and moves focus after
  // an answer (R14), after the render that enabled the button.
  useLayoutEffect(() => {
    if (caret.current !== null && nameRef.current) {
      nameRef.current.setSelectionRange(caret.current, caret.current);
    }
    caret.current = null;
  });
  useEffect(() => {
    if (!focusAsk) return;
    (focusAsk.to === "name" ? nameRef : createRef).current?.focus();
  }, [focusAsk]);

  const guard = useFormGuard({
    hasContent: hasFormContent({ name: nameText, topic, people: selected }),
    formName: t("createChannel.title"),
    onClose: () => onClose(),
  });

  const candidates = useMemo(
    () =>
      people
        .filter((p) => p.status === "active" && p.id !== currentUserId)
        .map((p) => ({
          id: p.id,
          displayName: p.displayName,
          hue: personHue(p.id),
        })),
    [people, currentUserId],
  );

  const settle = (to: "name" | "create") => {
    setBusy(false);
    busyRef.current = false;
    setFocusAsk((previous) => ({ to, n: (previous?.n ?? 0) + 1 }));
  };

  const submit = async () => {
    if (!canCreate || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setFailure(null);
    const sentName = name;
    const result = await submitCreateChannel({
      ensureOnline,
      createChannel: (body) => conversations.createChannel(body),
      newId,
      attempt,
      values: { name, isPrivate, topic, memberIds: selected },
    });
    // The command has updated the store whatever happens here; a dialog that is
    // gone has nobody to tell (R12).
    if (!mounted.current) return;
    switch (result.kind) {
      case "created":
        busyRef.current = false;
        onCreated?.(result.id);
        onClose();
        onOpenConversation(result.id);
        return;
      case "nameTaken":
        setRefusedName(sentName);
        return settle("name");
      case "invalidMember": {
        await conversations.refresh();
        if (!mounted.current) return;
        if (conversations.getState().error !== null) {
          setFailure("actionFailed");
        } else {
          const active = new Set(
            conversations
              .getPeople()
              .filter((p) => p.status === "active")
              .map((p) => p.id),
          );
          setSelected((ids) => ids.filter((id) => active.has(id)));
          setFailure("invalidMember");
        }
        return settle("create");
      }
      case "failed":
        setFailure("actionFailed");
        return settle("create");
      default:
        // `blocked` (the toast explained) and `silent`.
        return settle("create");
    }
  };

  const onNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const raw = input.value;
    const isComposing =
      composing.current || (event.nativeEvent as InputEvent).isComposing;
    if (isComposing) {
      setNameText(raw);
      return;
    }
    const next = normalizeChannelName(raw);
    if (next !== raw) {
      caret.current =
        next.length === raw.length ? input.selectionStart : next.length;
    }
    setNameText(next);
  };

  const onNameCompositionEnd = () => {
    composing.current = false;
    const input = nameRef.current;
    if (!input) return;
    const next = normalizeChannelName(input.value);
    if (next !== input.value) caret.current = input.selectionStart;
    setNameText(next);
  };

  // Enter presses Create when it is enabled, never while an input method is
  // composing (R5).
  const onEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    void submit();
  };

  const nameError =
    !nameVerdict.valid && nameVerdict.message === "invalid"
      ? t("createChannel.name.error.invalid")
      : !nameVerdict.valid && nameVerdict.message === "tooLong"
        ? t("createChannel.error.tooLong", { count: CHANNEL_NAME_MAX })
        : nameTaken
          ? t("createChannel.name.error.taken")
          : undefined;
  const topicError = topicVerdict.valid
    ? undefined
    : t("createChannel.error.tooLong", { count: CHANNEL_TOPIC_MAX });

  return (
    <>
      <Modal
        open={open}
        title={t("createChannel.title")}
        closeLabel={busy ? undefined : t("common.close")}
        returnFocusRef={returnFocusRef}
        onRequestClose={busy ? () => {} : guard.onRequestClose}
        footer={
          <div className="ccfoot">
            {failure ? (
              <div className="gerr" role="alert">
                {failure === "invalidMember"
                  ? t("createChannel.error.invalidMember")
                  : t("common.error.actionFailed")}
              </div>
            ) : null}
            <div className="ccbtns">
              <Button onClick={guard.requestClose} disabled={busy}>
                {t("common.cancel")}
              </Button>
              <Button
                ref={createRef}
                variant="primary"
                type="button"
                disabled={!canCreate}
                aria-busy={busy ? "true" : undefined}
                onClick={() => void submit()}
              >
                {t("createChannel.submit")}
              </Button>
            </div>
          </div>
        }
      >
        <div onFocusCapture={guard.trackFocus}>
          <Field
            ref={nameRef}
            label={t("createChannel.name.label")}
            value={nameText}
            onChange={(event) =>
              onNameChange(event as ChangeEvent<HTMLInputElement>)
            }
            onCompositionStart={() => {
              composing.current = true;
            }}
            onCompositionEnd={onNameCompositionEnd}
            onKeyDown={onEnter}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            data-autofocus
            readOnly={busy}
            error={nameError}
          />
          <div className="ccrow">
            <span className="grow" id={privateLabelId}>
              {t("createChannel.private.label")}
            </span>
            <Switch
              labelledBy={privateLabelId}
              checked={isPrivate}
              onChange={setIsPrivate}
              disabled={busy}
            />
          </div>
          <p className="cchint">{t("createChannel.private.hint")}</p>
          <Field
            label={t("createChannel.topic.label")}
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            onKeyDown={onEnter}
            autoComplete="off"
            readOnly={busy}
            error={topicError}
          />
          <fieldset
            className="ccpeople"
            aria-labelledby={peopleLabelId}
            disabled={busy}
          >
            <div className="lbl" id={peopleLabelId}>
              {t("createChannel.people.label")}
            </div>
            <PeoplePicker
              people={candidates}
              selected={selected}
              onChange={setSelected}
              max={CHANNEL_MEMBERS_ADD_MAX}
              limitMessage={t("createChannel.people.limit", {
                count: CHANNEL_MEMBERS_ADD_MAX,
              })}
              searchLabel={t("picker.search.label")}
              emptyText={t("picker.empty")}
              removeLabel={(personName) =>
                t("picker.chip.remove", { name: personName })
              }
            />
          </fieldset>
        </div>
      </Modal>
      {guard.discardDialog}
    </>
  );
}
