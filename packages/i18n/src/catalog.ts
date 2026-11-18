// The shapes a catalog can have. Types only, so the check can use them with no Node API.
export type PluralForms = Partial<
  Record<"zero" | "one" | "two" | "few" | "many" | "other", string>
>;

export type Catalog = { [name: string]: string | PluralForms | Catalog };

type Leaves<T, Path extends string = ""> = T extends string
  ? Path
  : T extends { other: string }
    ? Path
    : {
        [K in keyof T & string]: Leaves<
          T[K],
          Path extends "" ? K : `${Path}.${K}`
        >;
      }[keyof T & string];

// Every key that has a text in the catalog T, as "namespace.part.part".
export type KeysOf<T> = Leaves<T>;
