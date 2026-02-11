// https://gist.github.com/chrismichaelps/c0a8b3ea083ad2e01357f4f2990bba9a

export interface Predicate<A> {
  (a: A): boolean;
}

export interface Refinement<A, B extends A> {
  (a: A): a is B;
}

export const isString = (u: unknown): u is string => typeof u === "string";

export const isNumber = (u: unknown): u is number => typeof u === "number";

export const isBoolean = (u: unknown): u is boolean => typeof u === "boolean";

export const isNull = (u: unknown): u is null => u === null;

export const isUndefined = (u: unknown): u is undefined => u === undefined;

export const isNullish = (u: unknown): u is null | undefined => u == null;

export const isNotNull = <A>(u: A | null): u is A => u !== null;

export const isNotUndefined = <A>(u: A | undefined): u is A => u !== undefined;

export const isNotNullish = <A>(u: A | null | undefined): u is A => u != null;

export const isRecord = (u: unknown): u is Record<string, unknown> =>
  typeof u === "object" && u !== null && !Array.isArray(u);

export const isArray = (u: unknown): u is unknown[] => Array.isArray(u);

export const isTagged =
  <Tag extends string>(tag: Tag): Refinement<unknown, { readonly _tag: Tag }> =>
  (u: unknown): u is { readonly _tag: Tag } =>
    isRecord(u) && "_tag" in u && u._tag === tag;

export function not<A>(predicate: Predicate<A>): Predicate<A> {
  return (a) => !predicate(a);
}

export function and<A>(first: Predicate<A>, second: Predicate<A>): Predicate<A> {
  return (a) => first(a) && second(a);
}

export function or<A>(first: Predicate<A>, second: Predicate<A>): Predicate<A> {
  return (a) => first(a) || second(a);
}

export function all<A>(predicates: readonly Predicate<A>[]): Predicate<A> {
  return (a) => predicates.every((p) => p(a));
}

export function any<A>(predicates: readonly Predicate<A>[]): Predicate<A> {
  return (a) => predicates.some((p) => p(a));
}

export const isFunction = (u: unknown): u is Function => typeof u === "function";

export const isPromise = (u: unknown): u is Promise<unknown> => u instanceof Promise;

export const isDate = (u: unknown): u is Date => u instanceof Date;

export const isRegExp = (u: unknown): u is RegExp => u instanceof RegExp;

export const isError = (u: unknown): u is Error => u instanceof Error;

export const isEmptyString = (u: unknown): u is "" => u === "";

export const isNonEmptyString = (u: unknown): u is string => isString(u) && u.length > 0;

export const isPositiveNumber = (u: unknown): u is number => isNumber(u) && u > 0;

export const isNegativeNumber = (u: unknown): u is number => isNumber(u) && u < 0;

export const isInteger = (u: unknown): u is number => isNumber(u) && Number.isInteger(u);

export const isFiniteNumber = (u: unknown): u is number => isNumber(u) && Number.isFinite(u);

export const isSafeInteger = (u: unknown): u is number => isNumber(u) && Number.isSafeInteger(u);

export const isPlainObject = (u: unknown): u is Record<string, unknown> => {
  if (!isRecord(u)) return false;
  return Object.getPrototypeOf(u) === Object.prototype;
};

export const isEmptyArray = (u: unknown): u is unknown[] => isArray(u) && u.length === 0;

export const isNonEmptyArray = <A>(u: unknown): u is A[] => isArray(u) && u.length > 0;

export const isEmptyObject = (u: unknown): u is Record<string, never> =>
  isPlainObject(u) && Object.keys(u).length === 0;

export const hasProperty = <A, K extends string>(obj: A, key: K): obj is A & Record<K, unknown> =>
  isNotNullish(obj) && key in (obj as object);

export const getProperty = <A extends Record<string, unknown>, K extends string>(
  obj: A,
  key: K
): A[K] | undefined => {
  if (!isPlainObject(obj)) return undefined;
  return obj[key] as A[K] | undefined;
};

export const tuple = <T extends readonly unknown[]>(...values: T): T => values;

export const collect =
  <T>(predicate: Predicate<T>) =>
  (list: readonly T[]): readonly T[] =>
    list.filter(predicate);

export const partition =
  <T>(predicate: Predicate<T>) =>
  (list: readonly T[]): [readonly T[], readonly T[]] =>
    list.reduce(
      ([pass, fail], item) => {
        predicate(item) ? pass.push(item) : fail.push(item);
        return [pass, fail];
      },
      [[], []] as [T[], T[]]
    ) as [readonly T[], readonly T[]];
