---
category: Features
alias: functional-utilities
title: Functional Utilities
description: Composition, Option, Either/Result, and predicate helpers
---

# Functional Utilities

Tagix ships a small functional toolkit used throughout the library and exported for your own code: composition helpers, `Option` and `Either`/`Result` types, and predicate combinators. They are tree-shakeable and have no runtime dependencies.

These pair naturally with [Selectors](20-selectors.md) (including the `Order` and `Lens` modules documented there).

## Composition: `pipe` and `flow`

`pipe` threads a value through a sequence of functions left to right. `flow` builds a reusable function from the same sequence.

```ts
import { pipe, flow } from "tagix";

pipe(
  2,
  (n) => n * 3,
  (n) => n + 1
); // 7

const transform = flow(
  (n: number) => n * 3,
  (n) => n + 1
);
transform(2); // 7
```

Most combinators below have a **data-last** form designed for `pipe`: call them with just the operation and they return a function awaiting the value.

## Option

`Option<A>` models a value that may be absent — `Some(value)` or `None` — without resorting to `null`/`undefined`.

```ts
import { some, none, isSome, isNone } from "tagix";

const a = some(42);
const b = none<number>();

isSome(a); // true
isNone(b); // true
```

### Constructing

```ts
import { fromNullableOption, fromPredicateOption } from "tagix";

fromNullableOption(maybeValue); // Some(value) unless null/undefined -> None

fromPredicateOption(4, (n) => n > 0); // Some(4)
pipe(
  -1,
  fromPredicateOption((n: number) => n > 0)
); // None
```

`fromPredicateOption` narrows the result type when given a type-guard refinement:

```ts
const isString = (u: unknown): u is string => typeof u === "string";
const opt = fromPredicateOption(value, isString); // Option<string>
```

### Transforming

`mapOption`, `flatMapOption`, `filter`, and `tap` each work data-first (`mapOption(option, f)`) or data-last (`mapOption(f)`) for `pipe`:

```ts
import { mapOption, flatMapOption, filter, getOrElseOption } from "tagix";

pipe(
  some(8),
  filter((n: number) => n % 2 === 0),
  mapOption((n) => n / 2),
  getOrElseOption(() => 0)
); // 4
```

### Combining and unwrapping

```ts
import { allOption, matchOption, getOrElseOption } from "tagix";

allOption([some(1), some(2), some(3)]); // Some([1, 2, 3])
allOption([some(1), none<number>()]); // None (short-circuits)

matchOption(some(5), {
  onNone: () => "empty",
  onSome: (n) => `value: ${n}`,
}); // "value: 5"

getOrElseOption(none<number>(), () => 0); // 0
```

## Either and Result

`Either<E, A>` holds one of two values — `Left(error)` or `Right(value)` — typically an error on the left and a success on the right. `Result<A>` is the common alias for `Either<Error, A>`.

```ts
import { left, right, isLeft, isRight, matchEither } from "tagix";

const ok = right<number>(42);
const err = left<string>("boom");

matchEither(ok, {
  onLeft: (e) => `error: ${e}`,
  onRight: (v) => `ok: ${v}`,
}); // "ok: 42"
```

### Constructing

```ts
import { fromNullableEither, fromPredicateEither, tryCatch } from "tagix";

fromNullableEither(value, () => "was nullish");

fromPredicateEither(
  4,
  (n) => n > 0,
  () => "not positive"
); // Right(4)
pipe(
  -1,
  fromPredicateEither(
    (n: number) => n > 0,
    () => "not positive"
  )
); // Left("not positive")

tryCatch(
  () => JSON.parse(input),
  (error) => `parse failed: ${String(error)}`
);
```

### Transforming and combining

`mapEither`, `flatMapEither`, and `getOrElseEither` follow the same data-first/data-last pattern; `mapLeft` transforms the error channel.

```ts
import { mapEither, flatMapEither, allEither, getOrThrow } from "tagix";

allEither([right(1), right(2)]); // Right([1, 2])
allEither([right(1), left("boom")]); // Left("boom") (first Left wins)

getOrThrow(right(42)); // 42 — throws the Left value if it is a Left
```

### Result helpers

For the `Result<A>` (`Either<Error, A>`) alias, Tagix provides ergonomic constructors and operators: `ok`, `fail`, `toResult`, `toResultAsync`, `resultFromNullable`, `resultMap`, `resultMapError`, `resultFlatMap`, `resultGetOrElse`, and `resultGetOrThrow`.

```ts
import { ok, resultMap, resultGetOrElse } from "tagix";

const doubled = resultMap(ok(10), (n) => n * 2); // Right(20)
resultGetOrElse(doubled, 0); // 20 — second argument is a fallback value
```

## Predicates

Type-guard helpers narrow `unknown` values, and combinators build new predicates from existing ones.

```ts
import { isString, isNumber, isNonEmptyString, isRecord } from "tagix";

isString("x"); // true, narrows to string
isNonEmptyString(""); // false
isRecord({}); // true (plain object, not array/null)
```

Combine predicates with `and`, `or`, `not` (two predicates each) and `all`, `any` (an array of predicates). These operate on plain `Predicate<A>` values — `(a: A) => boolean` — and return a new predicate:

```ts
import { and, or, not, all } from "tagix";

const isEven = (n: number) => n % 2 === 0;
const isPositive = (n: number) => n > 0;

const isPositiveEven = and(isEven, isPositive);
isPositiveEven(4); // true
isPositiveEven(-2); // false

const isOdd = not(isEven);
const passesAll = all([isEven, isPositive]);
```

These compose directly with `filter` and `fromPredicateOption`/`fromPredicateEither`. (For type narrowing, use the individual `is*` guards above, which are type predicates.)

## Brand (nominal types)

`Brand<T, Name>` gives a structurally-identical type a distinct nominal identity, so values like ids and units can't be mixed up at compile time even though they are the same type at runtime. Brands are exported as the `Brand` namespace.

```ts
import { Brand } from "tagix";

type UserId = Brand.Brand<string, "UserId">;
type OrderId = Brand.Brand<string, "OrderId">;

const UserId = Brand.nominal<string, "UserId">();
const id = UserId("u_123"); // UserId — still a string at runtime

const s: string = id; // ok — a UserId is assignable to its base
declare const order: OrderId;
// const bad: OrderId = id; // type error — UserId and OrderId are distinct
```

Validate at construction with `Brand.refined`, which returns an `Either`:

```ts
type Email = Brand.Brand<string, "Email">;

const Email = Brand.refined<string, "Email", string>(
  (s) => s.includes("@"),
  (s) => `invalid email: ${s}`
);

Email("a@b.com"); // Right(Email)
Email("nope"); // Left("invalid email: nope")
```

Use `Brand.is` to build a type-guard that narrows a base value to the brand:

```ts
const isInt = Brand.is<number, "Int">(Number.isInteger);
if (isInt(n)) {
  // n is Brand<number, "Int"> here
}
```

Brands compose: `Brand.Brand<number, "Int"> & Brand.Brand<number, "Positive">` is assignable to either brand.

## See Also

- [Selectors](20-selectors.md) — `Order` comparators and `Lens` optics
- [Error Handling](23-error-handling.md) — tagged errors and recovery
- [Type Safety](40-type-safety.md) — TypeScript patterns
