// https://gist.github.com/chrismichaelps/c0a8b3ea083ad2e01357f4f2990bba9a

const TypeId = Symbol.for("Either");
type TypeId = typeof TypeId;

export interface Left<E> {
  readonly _tag: "Left";
  readonly left: E;
  readonly [TypeId]: TypeId;
}

export interface Right<A> {
  readonly _tag: "Right";
  readonly right: A;
  readonly [TypeId]: TypeId;
}

export type Either<E, A> = Left<E> | Right<A>;

export const left = <E, A = never>(e: E): Either<E, A> => ({
  _tag: "Left",
  left: e,
  [TypeId]: TypeId,
});

export const right = <A, E = never>(a: A): Either<E, A> => ({
  _tag: "Right",
  right: a,
  [TypeId]: TypeId,
});

export const isEither = (u: unknown): u is Either<unknown, unknown> =>
  typeof u === "object" && u !== null && TypeId in u;

export const isLeft = <E, A>(either: Either<E, A>): either is Left<E> => either._tag === "Left";

export const isRight = <E, A>(either: Either<E, A>): either is Right<A> => either._tag === "Right";

export const fromNullable = <A, E>(
  value: A | null | undefined,
  onNullable: () => E
): Either<E, NonNullable<A>> =>
  value == null ? left(onNullable()) : right(value as NonNullable<A>);

export const tryCatch = <A, E>(tryFn: () => A, onThrow: (error: unknown) => E): Either<E, A> => {
  try {
    return right(tryFn());
  } catch (error) {
    return left(onThrow(error));
  }
};

export const tryCatchAsync = async <A, E>(
  tryFn: () => Promise<A>,
  onThrow: (error: unknown) => E
): Promise<Either<E, A>> => {
  try {
    return right(await tryFn());
  } catch (error) {
    return left(onThrow(error));
  }
};

export function match<E, A, B, C>(
  either: Either<E, A>,
  cases: { readonly onLeft: (e: E) => B; readonly onRight: (a: A) => C }
): B | C {
  return isLeft(either) ? cases.onLeft(either.left) : cases.onRight(either.right);
}

export function map<A, B>(f: (a: A) => B): <E>(either: Either<E, A>) => Either<E, B>;
export function map<E, A, B>(either: Either<E, A>, f: (a: A) => B): Either<E, B>;
export function map<E, A, B>(
  eitherOrF: Either<E, A> | ((a: A) => B),
  f?: (a: A) => B
): Either<E, B> | (<E2>(either: Either<E2, A>) => Either<E2, B>) {
  if (f === undefined) {
    const fn = eitherOrF as (a: A) => B;
    return <E2>(either: Either<E2, A>) => (isLeft(either) ? either : right(fn(either.right)));
  }
  const either = eitherOrF as Either<E, A>;
  return isLeft(either) ? either : right(f(either.right));
}

export function mapLeft<E, E2>(f: (e: E) => E2): <A>(either: Either<E, A>) => Either<E2, A>;
export function mapLeft<E, A, E2>(either: Either<E, A>, f: (e: E) => E2): Either<E2, A>;
export function mapLeft<E, A, E2>(
  eitherOrF: Either<E, A> | ((e: E) => E2),
  f?: (e: E) => E2
): Either<E2, A> | (<A2>(either: Either<E, A2>) => Either<E2, A2>) {
  if (f === undefined) {
    const fn = eitherOrF as (e: E) => E2;
    return <A2>(either: Either<E, A2>) => (isRight(either) ? either : left(fn(either.left)));
  }
  const either = eitherOrF as Either<E, A>;
  return isRight(either) ? either : left(f(either.left));
}

export function flatMap<A, E2, B>(
  f: (a: A) => Either<E2, B>
): <E>(either: Either<E, A>) => Either<E | E2, B>;
export function flatMap<E, A, E2, B>(
  either: Either<E, A>,
  f: (a: A) => Either<E2, B>
): Either<E | E2, B>;
export function flatMap<E, A, E2, B>(
  eitherOrF: Either<E, A> | ((a: A) => Either<E2, B>),
  f?: (a: A) => Either<E2, B>
): Either<E | E2, B> | (<E3>(either: Either<E3, A>) => Either<E3 | E2, B>) {
  if (f === undefined) {
    const fn = eitherOrF as (a: A) => Either<E2, B>;
    return <E3>(either: Either<E3, A>) => (isLeft(either) ? either : fn(either.right));
  }
  const either = eitherOrF as Either<E, A>;
  return isLeft(either) ? either : f(either.right);
}

export const getOrElse = <E, A, B>(either: Either<E, A>, orElse: (e: E) => B): A | B =>
  isLeft(either) ? orElse(either.left) : either.right;

export const getOrThrow = <E, A>(either: Either<E, A>): A => {
  if (isLeft(either)) {
    throw either.left;
  }
  return either.right;
};

export type Result<A> = Either<Error, A>;

export const ok = <A>(a: A): Result<A> => right(a);

export const fail = <A>(e: Error): Result<A> => left(e);

export const toResult = <A>(fn: () => A): Result<A> =>
  tryCatch(fn, (e) => (e instanceof Error ? e : new Error(String(e))));

export const toResultAsync = async <A>(fn: () => Promise<A>): Promise<Result<A>> =>
  tryCatchAsync(fn, (e) => (e instanceof Error ? e : new Error(String(e))));

export const resultFromNullable = <A>(
  value: A | null | undefined,
  onNull: () => Error
): Result<NonNullable<A>> => (value == null ? fail(onNull()) : ok(value as NonNullable<A>));

export const resultGetOrThrow = <A>(result: Result<A>): A => {
  if (isLeft(result)) {
    throw result.left;
  }
  return result.right;
};

export const resultGetOrElse = <A>(result: Result<A>, defaultValue: A): A =>
  isLeft(result) ? defaultValue : result.right;

export const resultMap = <A, B>(result: Result<A>, f: (a: A) => B): Result<B> => map(result, f);

export const resultMapError = <A>(result: Result<A>, f: (e: Error) => Error): Result<A> =>
  mapLeft(result, f);

export const resultFlatMap = <A, B>(result: Result<A>, f: (a: A) => Result<B>): Result<B> =>
  flatMap(result, f);
