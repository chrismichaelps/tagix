// https://gist.github.com/chrismichaelps/c0a8b3ea083ad2e01357f4f2990bba9a

import { OptionNoneError } from "../../store/error";

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

/**
 * Builds an `Option` from a value and a predicate: `Some(value)` when the
 * predicate holds, otherwise `None`. A type-guard predicate narrows the result.
 * Dual: data-first `fromPredicate(value, pred)` or data-last `fromPredicate(pred)`.
 * @example
 * ```ts
 * fromPredicate(4, (n) => n > 0);          // Some(4)
 * pipe(-1, fromPredicate((n: number) => n > 0)); // None
 * ```
 */
export function fromPredicate<A, B extends A>(refinement: (a: A) => a is B): (a: A) => Option<B>;
export function fromPredicate<A>(predicate: (a: A) => boolean): (a: A) => Option<A>;
export function fromPredicate<A, B extends A>(a: A, refinement: (a: A) => a is B): Option<B>;
export function fromPredicate<A>(a: A, predicate: (a: A) => boolean): Option<A>;
export function fromPredicate<A>(
  valueOrPredicate: A | ((a: A) => boolean),
  predicate?: (a: A) => boolean
): Option<A> | ((a: A) => Option<A>) {
  if (predicate === undefined) {
    const pred = valueOrPredicate as (a: A) => boolean;
    return (a: A) => (pred(a) ? some(a) : none<A>());
  }
  const a = valueOrPredicate as A;
  return predicate(a) ? some(a) : none<A>();
}

/**
 * Combines an iterable of `Option`s into a single `Option` of an array.
 * Returns `Some` of all values when every element is `Some`, otherwise `None`
 * (short-circuiting on the first `None`).
 * @example
 * ```ts
 * all([some(1), some(2)]); // Some([1, 2])
 * all([some(1), none()]);  // None
 * ```
 */
export function all<A>(options: Iterable<Option<A>>): Option<A[]> {
  const values: A[] = [];
  for (const option of options) {
    if (isNone(option)) return none<A[]>();
    values.push(option.value);
  }
  return some(values);
}

export const getOrNull = <A>(option: Option<A>): A | null => (isNone(option) ? null : option.value);

export const getOrUndefined = <A>(option: Option<A>): A | undefined =>
  isNone(option) ? undefined : option.value;

export function getOrElse<A, B>(orElse: () => B): (option: Option<A>) => A | B;
export function getOrElse<A, B>(option: Option<A>, orElse: () => B): A | B;
export function getOrElse<A, B>(
  optionOrOrElse: Option<A> | (() => B),
  orElse?: () => B
): (A | B) | ((option: Option<A>) => A | B) {
  if (orElse === undefined) {
    const fn = optionOrOrElse as () => B;
    return (option: Option<A>) => (isNone(option) ? fn() : option.value);
  }
  const option = optionOrOrElse as Option<A>;
  return isNone(option) ? orElse() : option.value;
}

export function orElse<A, B>(that: () => Option<B>): (option: Option<A>) => Option<A | B>;
export function orElse<A, B>(option: Option<A>, that: () => Option<B>): Option<A | B>;
export function orElse<A, B>(
  optionOrThat: Option<A> | (() => Option<B>),
  that?: () => Option<B>
): Option<A | B> | ((option: Option<A>) => Option<A | B>) {
  if (that === undefined) {
    const fn = optionOrThat as () => Option<B>;
    return (option: Option<A>) => (isNone(option) ? fn() : option);
  }
  const option = optionOrThat as Option<A>;
  return isNone(option) ? that() : option;
}

export const match = <A, B, C>(
  option: Option<A>,
  cases: { readonly onNone: () => B; readonly onSome: (a: A) => C }
): B | C => (isNone(option) ? cases.onNone() : cases.onSome(option.value));

export function map<A, B>(f: (a: A) => B): (option: Option<A>) => Option<B>;
export function map<A, B>(option: Option<A>, f: (a: A) => B): Option<B>;
export function map<A, B>(
  optionOrF: Option<A> | ((a: A) => B),
  f?: (a: A) => B
): Option<B> | ((option: Option<A>) => Option<B>) {
  if (f === undefined) {
    const fn = optionOrF as (a: A) => B;
    return (option: Option<A>) => (isNone(option) ? none<B>() : some(fn(option.value)));
  }
  const option = optionOrF as Option<A>;
  return isNone(option) ? none<B>() : some(f(option.value));
}

export function flatMap<A, B>(f: (a: A) => Option<B>): (option: Option<A>) => Option<B>;
export function flatMap<A, B>(option: Option<A>, f: (a: A) => Option<B>): Option<B>;
export function flatMap<A, B>(
  optionOrF: Option<A> | ((a: A) => Option<B>),
  f?: (a: A) => Option<B>
): Option<B> | ((option: Option<A>) => Option<B>) {
  if (f === undefined) {
    const fn = optionOrF as (a: A) => Option<B>;
    return (option: Option<A>) => (isNone(option) ? none<B>() : fn(option.value));
  }
  const option = optionOrF as Option<A>;
  return isNone(option) ? none<B>() : f(option.value);
}

export function filter<A>(predicate: (a: A) => boolean): (option: Option<A>) => Option<A>;
export function filter<A>(option: Option<A>, predicate: (a: A) => boolean): Option<A>;
export function filter<A>(
  optionOrPredicate: Option<A> | ((a: A) => boolean),
  predicate?: (a: A) => boolean
): Option<A> | ((option: Option<A>) => Option<A>) {
  if (predicate === undefined) {
    const pred = optionOrPredicate as (a: A) => boolean;
    return (option: Option<A>) =>
      isNone(option) ? none<A>() : pred(option.value) ? option : none<A>();
  }
  const option = optionOrPredicate as Option<A>;
  return isNone(option) ? none<A>() : predicate(option.value) ? option : none<A>();
}

export function tap<A>(f: (a: A) => void): (option: Option<A>) => Option<A>;
export function tap<A>(option: Option<A>, f: (a: A) => void): Option<A>;
export function tap<A>(
  optionOrF: Option<A> | ((a: A) => void),
  f?: (a: A) => void
): Option<A> | ((option: Option<A>) => Option<A>) {
  const run = (option: Option<A>, fn: (a: A) => void): Option<A> => {
    if (isSome(option)) {
      fn(option.value);
    }
    return option;
  };
  if (f === undefined) {
    const fn = optionOrF as (a: A) => void;
    return (option: Option<A>) => run(option, fn);
  }
  return run(optionOrF as Option<A>, f);
}

export const unwrap = <A>(option: Option<A>): A => {
  if (isNone(option)) {
    throw new OptionNoneError({ message: "Cannot unwrap None" });
  }
  return (option as Some<A>).value;
};

export const expect = <A>(option: Option<A>, message: string): A => {
  if (isNone(option)) {
    throw new OptionNoneError({ message });
  }
  return (option as Some<A>).value;
};
