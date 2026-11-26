import { Avatar, EmptyState, PersonChip } from "@toki/ui-web";
import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent,
  type RefObject,
} from "react";
import { useMoreOnScroll } from "../useMoreOnScroll";
import { matchPeople } from "./matchPeople";
import "../rows.css";

const WINDOW = 50;
const DEFAULT_MAX = 7;

export type PickerPerson = { id: string; displayName: string; hue: number };

export type PeoplePickerProps = {
  people: readonly PickerPerson[];
  // The chosen ids in the order pressed: the picker is controlled for this and for nothing else.
  selected: readonly string[];
  onChange: (ids: string[]) => void;
  limitMessage: string;
  searchLabel: string;
  emptyText: string;
  removeLabel: (name: string) => string;
  max?: number;
  inputRef?: RefObject<HTMLInputElement | null>;
};

// The search box that holds the chosen people as chips, and the list of people under it (R18).
// It holds the search text and the window of the list, and no store and no text of its own.
export function PeoplePicker({
  people,
  selected,
  onChange,
  limitMessage,
  searchLabel,
  emptyText,
  removeLabel,
  max = DEFAULT_MAX,
  inputRef,
}: PeoplePickerProps) {
  const [text, setText] = useState("");
  const [shown, setShown] = useState(WINDOW);
  // The message belongs to one `selected` and one text: any change of either hides it.
  const [limited, setLimited] = useState<{
    selected: readonly string[];
    text: string;
  } | null>(null);
  const ownInput = useRef<HTMLInputElement | null>(null);
  const input = inputRef ?? ownInput;
  const matches = useMemo(() => matchPeople(people, text), [people, text]);
  const visible = matches.slice(0, shown);
  const more = useMoreOnScroll({
    enabled: matches.length > shown,
    onMore: () => setShown((n) => n + WINDOW),
  });
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const showLimit =
    limited !== null &&
    limited.text === text &&
    limited.selected.length === selected.length &&
    limited.selected.every((id, i) => id === selected[i]);

  const onText = (event: ChangeEvent<HTMLInputElement>) => {
    setText(event.target.value);
    setShown(WINDOW);
    if (more.ref.current) more.ref.current.scrollTop = 0;
  };

  const press = (person: PickerPerson) => {
    if (selected.includes(person.id)) {
      onChange(selected.filter((id) => id !== person.id));
      return;
    }
    if (selected.length >= max) {
      setLimited({ selected, text });
      return;
    }
    onChange([...selected, person.id]);
    setText("");
    setShown(WINDOW);
  };

  const onBox = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button")) return;
    input.current?.focus();
  };

  return (
    <div>
      {/* The box is a div and not a Field: a label must not wrap buttons. A press outside a chip
          focuses the input; the input is what the keyboard reaches. */}
      <div className="field pk" onClick={onBox}>
        {selected.map((id) => {
          const person = byId.get(id);
          if (!person) return null;
          return (
            <PersonChip
              key={id}
              name={person.displayName}
              hue={person.hue}
              removeLabel={removeLabel(person.displayName)}
              onRemove={() => {
                onChange(selected.filter((x) => x !== id));
                input.current?.focus();
              }}
            />
          );
        })}
        <input
          ref={input}
          type="search"
          aria-label={searchLabel}
          placeholder={searchLabel}
          data-autofocus
          value={text}
          onChange={onText}
        />
      </div>
      {showLimit ? <div role="alert">{limitMessage}</div> : null}
      <div
        {...more}
        className={
          matches.length === 0 ? "mlist people is-empty" : "mlist people"
        }
      >
        {matches.length === 0 ? (
          <EmptyState icon="users" title={emptyText} description="" />
        ) : (
          <ul>
            {visible.map((person) => (
              <li key={person.id}>
                <button
                  type="button"
                  className="prow"
                  aria-pressed={selected.includes(person.id)}
                  onClick={() => press(person)}
                >
                  <Avatar
                    name={person.displayName}
                    hue={person.hue}
                    size={30}
                  />
                  <span className="grow">{person.displayName}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
