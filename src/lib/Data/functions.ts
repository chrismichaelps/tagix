import { AbsurdError } from "../../store/error";
import { hasProperty, isFunction } from "./predicate";

export interface LazyArg<A> {
  (): A;
}

export const identity = <A>(a: A): A => a;

export const constant =
  <A>(value: A): LazyArg<A> =>
  () =>
    value;

export const constTrue: LazyArg<true> = constant(true);

export const constFalse: LazyArg<false> = constant(false);

export const constNull: LazyArg<null> = constant(null);

export const constUndefined: LazyArg<undefined> = constant(undefined);

export const constVoid: LazyArg<void> = constUndefined;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const absurd = <A>(_value: never): A => {
  throw new AbsurdError({ message: "Called `absurd` function which should be uncallable" });
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction = (...args: any[]) => any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyArgs = readonly any[];

type Fn<A = unknown, B = unknown> = (a: A) => B;

export function pipe<A>(a: A): A;
export function pipe<A, B>(a: A, ab: Fn<A, B>): B;
export function pipe<A, B, C>(a: A, ab: Fn<A, B>, bc: Fn<B, C>): C;
export function pipe<A, B, C, D>(a: A, ab: Fn<A, B>, bc: Fn<B, C>, cd: Fn<C, D>): D;
export function pipe<A, B, C, D, E>(
  a: A,
  ab: Fn<A, B>,
  bc: Fn<B, C>,
  cd: Fn<C, D>,
  de: Fn<D, E>
): E;
export function pipe<A, B, C, D, E, F>(
  a: A,
  ab: Fn<A, B>,
  bc: Fn<B, C>,
  cd: Fn<C, D>,
  de: Fn<D, E>,
  ef: Fn<E, F>
): F;
export function pipe(a: unknown, ...fns: Fn[]): unknown {
  return fns.reduce((acc, fn) => fn(acc), a);
}

export function flow<A extends readonly unknown[], B>(ab: (...a: A) => B): (...a: A) => B;
export function flow<A extends readonly unknown[], B, C>(
  ab: (...a: A) => B,
  bc: Fn<B, C>
): (...a: A) => C;
export function flow<A extends readonly unknown[], B, C, D>(
  ab: (...a: A) => B,
  bc: Fn<B, C>,
  cd: Fn<C, D>
): (...a: A) => D;
export function flow<A extends readonly unknown[], B, C, D, E>(
  ab: (...a: A) => B,
  bc: Fn<B, C>,
  cd: Fn<C, D>,
  de: Fn<D, E>
): (...a: A) => E;
export function flow(
  ab: (...args: readonly unknown[]) => unknown,
  ...rest: Fn[]
): (...args: readonly unknown[]) => unknown {
  if (rest.length === 0) return ab;
  return (...args) => rest.reduce((acc, fn) => fn(acc), ab(...args));
}

export function dual<DataLast extends AnyFunction, DataFirst extends AnyFunction>(
  arity: Parameters<DataFirst>["length"],
  body: DataFirst
): DataLast & DataFirst;
export function dual<DataLast extends AnyFunction, DataFirst extends AnyFunction>(
  isDataFirst: (args: AnyArgs) => boolean,
  body: DataFirst
): DataLast & DataFirst;
export function dual(
  arityOrIsDataFirst: number | ((args: AnyArgs) => boolean),
  body: AnyFunction
): AnyFunction {
  const isDataFirst =
    typeof arityOrIsDataFirst === "function"
      ? arityOrIsDataFirst
      : (args: AnyArgs) => args.length >= arityOrIsDataFirst;

  return function dualized(this: unknown, ...args: unknown[]) {
    if (isDataFirst(args)) {
      return body.apply(this, args);
    }
    return (self: unknown) => body.apply(this, [self, ...args]);
  };
}

type TaggedUnionTag<T> = T extends { readonly _tag: infer K }
  ? K extends string
    ? K
    : never
  : never;

export function matchTag<T extends { readonly _tag: string }, R>(
  value: T,
  cases: { [K in TaggedUnionTag<T>]: (value: Extract<T, { _tag: K }>) => R } & {
    _: (value: T) => R;
  }
): R {
  const tag = value._tag;
  if (hasProperty(cases, tag)) {
    const handler: unknown = cases[tag as keyof typeof cases];
    if (isFunction(handler)) {
      return (handler as (value: T) => R)(value);
    }
  }
  return cases._(value);
}
