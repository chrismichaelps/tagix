// https://gist.github.com/chrismichaelps/c0a8b3ea083ad2e01357f4f2990bba9a

const TypeId = Symbol.for("Option");
type TypeId = typeof TypeId;

export interface None {
  readonly _tag: "None";
  readonly [TypeId]: TypeId;
}

export interface Some<A> {
  readonly _tag: "Some";
  readonly value: A;
  readonly [TypeId]: TypeId;
}

export type Option<A> = None | Some<A>;

const noneInstance: None = { _tag: "None", [TypeId]: TypeId };

export const none = <A>(): Option<A> => noneInstance;

export const some = <A>(value: A): Option<A> => ({
  _tag: "Some",
  value,
  [TypeId]: TypeId,
});

export const isOption = (u: unknown): u is Option<unknown> =>
  typeof u === "object" && u !== null && TypeId in u;

export const isNone = <A>(option: Option<A>): option is None => option._tag === "None";

export const isSome = <A>(option: Option<A>): option is Some<A> => option._tag === "Some";

export const fromNullable = <A>(value: A | null | undefined): Option<NonNullable<A>> =>
  value == null ? none() : some(value as NonNullable<A>);

export const getOrNull = <A>(option: Option<A>): A | null => (isNone(option) ? null : option.value);

export const getOrUndefined = <A>(option: Option<A>): A | undefined =>
  isNone(option) ? undefined : option.value;

export const getOrElse = <A, B>(option: Option<A>, orElse: () => B): A | B =>
  isNone(option) ? orElse() : option.value;

export const orElse = <A, B>(option: Option<A>, that: () => Option<B>): Option<A | B> =>
  isNone(option) ? that() : option;

export const match = <A, B, C>(
  option: Option<A>,
  cases: { readonly onNone: () => B; readonly onSome: (a: A) => C }
): B | C => (isNone(option) ? cases.onNone() : cases.onSome(option.value));

export const map = <A, B>(option: Option<A>, f: (a: A) => B): Option<B> =>
  isNone(option) ? none() : some(f(option.value));

export const flatMap = <A, B>(option: Option<A>, f: (a: A) => Option<B>): Option<B> =>
  isNone(option) ? none() : f(option.value);

export const filter = <A>(option: Option<A>, predicate: (a: A) => boolean): Option<A> =>
  isNone(option) ? none() : predicate(option.value) ? option : none();

export const tap = <A>(option: Option<A>, f: (a: A) => void): Option<A> => {
  if (isSome(option)) {
    f(option.value);
  }
  return option;
};
