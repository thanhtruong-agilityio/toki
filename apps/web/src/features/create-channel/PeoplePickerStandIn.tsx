import { Avatar, IconButton } from "@toki/ui-web";
import { useState, type RefObject } from "react";

// TODO(TOKI-034): stand-in for `PeoplePicker` of `features/people/PeoplePicker.tsx`
// (TOKI-034 R18). It has the props that R18 names, so `deps.ts` replaces it with
// a re-export and nothing else changes. Its look is not this ticket's: it has no
// CSS. Every control is a native `input` or `button` with no `disabled` of its
// own, so a `fieldset` with `disabled` around it disables all of them (R10).
export type PeoplePickerProps = {
  people: ReadonlyArray<{ id: string; displayName: string; hue: number }>;
  selected: readonly string[];
  onChange: (ids: string[]) => void;
  limitMessage: string;
  searchLabel: string;
  emptyText: string;
  removeLabel: (name: string) => string;
  max?: number;
  inputRef?: RefObject<HTMLInputElement | null>;
};

const fold = (text: string) =>
  text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export function PeoplePicker({
  people,
  selected,
  onChange,
  limitMessage,
  searchLabel,
  emptyText,
  removeLabel,
  max = 7,
  inputRef,
}: PeoplePickerProps) {
  const [text, setText] = useState("");
  const [full, setFull] = useState(false);
  const byId = new Map(people.map((p) => [p.id, p]));
  const query = fold(text.trim());
  const shown = people.filter((p) => fold(p.displayName).includes(query));

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      setFull(false);
      onChange(selected.filter((s) => s !== id));
      return;
    }
    if (selected.length >= max) {
      setFull(true);
      return;
    }
    setFull(false);
    setText("");
    onChange([...selected, id]);
  };

  return (
    <div className="field pk">
      {selected.map((id) => {
        const person = byId.get(id);
        if (!person) return null;
        return (
          <span key={id} className="chip">
            {person.displayName}
            <IconButton
              icon="x"
              size="sm"
              label={removeLabel(person.displayName)}
              onClick={() => onChange(selected.filter((s) => s !== id))}
            />
          </span>
        );
      })}
      <input
        ref={inputRef}
        type="search"
        aria-label={searchLabel}
        data-autofocus
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      {full ? <p role="status">{limitMessage}</p> : null}
      <div className="mlist people">
        {shown.length === 0 ? (
          <p>{emptyText}</p>
        ) : (
          <ul>
            {shown.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="prow"
                  aria-pressed={selected.includes(p.id)}
                  onClick={() => toggle(p.id)}
                >
                  <Avatar name={p.displayName} hue={p.hue} size={30} />
                  <span className="grow">{p.displayName}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
