---
category: Features
alias: selectors
title: Selectors
description: Extract and derive values from state
---

# Selectors

Selectors extract and transform data from your state. They help you compute derived values and keep your components clean by separating state structure from presentation needs.

## Using Store Selectors

The store provides methods for selecting data directly from state.

```ts
const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

// Get a value from state with a type-safe accessor (inferred, autocompleted)
const value = store.select((s) => s.value);

// Check if the current state matches a tag
if (store.isInState("Ready")) {
  // State is Ready
}

// Get state wrapped in an Option type
const readyState = store.getState("Ready");
if (isSome(readyState)) {
  // Access readyState.value
}
```

## Built-in Selector Functions

Tagix provides several selector utilities that work with any state object.

### select

Extract a value from an object with a **type-safe accessor function**. The accessor parameter is inferred from the object you pass — no annotations, full autocomplete, and nested paths are fully checked. Traversal that hits a nullish value returns `undefined` instead of throwing.

```ts
import { select } from "tagix";

const state = { value: 42, user: { name: "test" }, _tag: "Ready" };

select(state, (s) => s.value); // 42        (number | undefined)
select(state, (s) => s.user.name); // "test" (string | undefined) — nested, fully typed
```

> **Migration:** the string-key form `select(state, "value")` still works but is `@deprecated`. Prefer the accessor — string keys are not type-checked for nested paths.

### pluck

Create a **reusable, type-safe selector** for a state type. `pluck` is curried by the state type (the same pattern as `lens<T>()`), so once you name the type the accessor parameter and return value are inferred — no `typeof`, no per-parameter annotation.

```ts
import { pluck } from "tagix";

interface State {
  value: number;
  user: { name: string };
}

const getValue = pluck<State>()((s) => s.value); // s inferred as State
getValue(state); // number | undefined

const getUserName = pluck<State>()((s) => s.user.name); // nested, fully typed
getUserName(state); // string | undefined
```

> **Migration:** the string-key form `pluck("value")` (and dot-paths like `pluck("user.name")`) still works but is `@deprecated` and returns `unknown` for nested keys.

### memoize

Cache selector results to avoid expensive recomputations. The memoized selector only recalculates when the input changes.

```ts
import { memoize } from "tagix";

let callCount = 0;

const expensiveSelector = memoize((input: { value: number }) => {
  callCount++;
  return input.value * 2;
});

const obj = { value: 5 };

expensiveSelector(obj); // 10, callCount = 1
expensiveSelector(obj); // 10 (cached), callCount still 1
expensiveSelector({ value: 5 }); // 10 (new reference), callCount = 2
```

### combineSelectors

Combine multiple selectors into one function that returns an array of results.

```ts
import { combineSelectors } from "tagix";

const getValue = (s: { value: number }) => s.value;
const getTag = (s: { _tag: string }) => s._tag;

const combined = combineSelectors(getValue, getTag);

const state = { value: 42, _tag: "Ready" };
const [value, tag] = combined(state);
// value = 42, tag = "Ready"
```

You can combine three or more selectors as well.

```ts
const getValue = (s: { value: number }) => s.value;
const getTag = (s: { _tag: string }) => s._tag;
const getActive = (s: { active: boolean }) => s.active;

const combined = combineSelectors(getValue, getTag, getActive);

const state = { value: 10, _tag: "Ready", active: true };
const [value, tag, active] = combined(state);
// value = 10, tag = "Ready", active = true
```

### patch

Create immutable updates by spreading a base object with new values.

```ts
import { patch } from "tagix";

const base = { value: 0, name: "test", active: true };

const updated = patch(base)({ value: 5, active: false });
updated.value;
// { value: 5, name: "test", active: false }
```

Chain multiple patches together.

```ts
const base = { x: 1, y: 2, z: 3 };

const update = patch(base);
const result = update({ x: 10 })({ y: 20 });
result.value;
// { x: 10, y: 20, z: 3 }
```

### getOrDefault

Provide a default value when a selector returns undefined.

```ts
import { getOrDefault } from "tagix";

const getter = (input: { value?: number }) => input.value;

const withDefault = getOrDefault(0);
withDefault(getter({ value: 5 })); // 5
withDefault(getter({ value: undefined })); // 0
withDefault(getter({})); // 0
```

## Complete Example

```ts
import { createStore, select, pluck, memoize, combineSelectors, patch, taggedEnum } from "tagix";

const UserState = taggedEnum({
  Idle: { user: null },
  Loading: {},
  Ready: { user: { name: "", email: "", age: 0 } },
  Error: { message: "" },
});

const store = createStore(
  UserState.Ready({
    user: { name: "Chris", email: "chris@test.com", age: 30 },
  }),
  UserState
);

// Simple selection with a type-safe accessor
const ready = store.stateValue as Extract<typeof UserState.State, { _tag: "Ready" }>;
const userName = select(ready.user, (u) => u.name);
// "Chris"

// Reusable curried selector — type named once, accessor inferred
const getUserName = pluck<typeof ready>()((s) => s.user.name);
const name = getUserName(ready);
// "Chris"

// Memoized expensive computation
const computeScore = memoize((user: { age: number }) => {
  console.log("Computing score...");
  return user.age * 10;
});

// Combine selectors
const getUserInfo = combineSelectors(
  (s: { user: { name: string; age: number } }) => s.user.name,
  (s: { user: { age: number } }) => s.user.age
);

// Immutable update
const updateUser = patch(ready.user)({ age: 31 }).value;
```

## Selector Patterns

### Derived State

Build derived values from your state.

```ts
interface User {
  first: string;
  last: string;
}

const getFullName = (user: User) => `${user.first} ${user.last}`;

const getUserData = combineSelectors(
  pluck<User>()((u) => u.first),
  pluck<User>()((u) => u.last),
  getFullName
);
```

### Conditional Selection

Handle optional values gracefully.

```ts
const getDisplayName = (user: { displayName?: string; username: string }) => {
  const display = select(user, (u) => u.displayName);
  return display ?? user.username;
};
```

## Lenses (Optics)

For composable, immutable **get and set** on deeply nested state, Tagix ships a small lens module. A lens is a first-class, type-safe optic — build one with `lens<State>()` and focus deeper with `.at(...)` or `.compose(...)`.

```ts
import { lens, prop } from "tagix";

interface State {
  user: { name: string; age: number };
  count: number;
}

const nameLens = lens<State>().at("user").at("name");

nameLens.get(state); // string
nameLens.set(state, "Ada"); // new State, immutable (siblings preserved)
nameLens.modify(state, (n) => n.toUpperCase()); // new State
```

Both `set` and `modify` are **dual**: call them data-first (`lens.set(state, value)`) or data-last (`lens.set(value)`) to produce a reusable `State => State` updater that composes with `pipe`/`flow`.

```ts
import { pipe, lens } from "tagix";

const countLens = lens<State>().at("count");

const next = pipe(
  state,
  countLens.modify((n) => n + 1),
  countLens.set(100)
);
```

`prop<State, "count">("count")` is shorthand for `lens<State>().at("count")`. Lenses pair naturally with action handlers for clean, immutable updates without manual spreading.

## Ordering and Sorting

For comparing and sorting derived values, Tagix ships a composable `Order` module (exported as a namespace). Build primitive orders, derive new ones from a field, and chain tie-breakers.

```ts
import { Order, pipe } from "tagix";

interface User {
  name: string;
  age: number;
}

const byAge = Order.mapInput(Order.number, (u: User) => u.age);
const byName = Order.mapInput(Order.string, (u: User) => u.name);

// Sort by age, then by name on ties — returns a new array (input untouched).
const ordered = pipe(users, Order.sort(Order.combine(byAge, byName)));
```

Primitive orders (`Order.number`, `Order.string`, `Order.boolean`, `Order.bigint`, `Order.date`) and combinators (`reverse`, `mapInput`, `combine`, `combineAll`, `array`) compose freely. Comparison helpers — `lessThan`, `greaterThan` (and inclusive variants), `min`, `max`, `clamp`, `between`, `sort` — each take an `Order` and return a ready-to-use function.

```ts
const clampScore = Order.clamp(Order.number);
clampScore(120, { minimum: 0, maximum: 100 }); // 100

const newest = Order.max(Order.date);
newest(a.createdAt, b.createdAt); // the later Date
```

### Reactivity with Memoization

Prevent unnecessary recalculations when state changes.

```ts
const expensiveTransform = memoize((data: { items: number[] }) => {
  return data.items.reduce((sum, item) => sum + item, 0);
});
```

## Best Practices

### Keep Selectors Pure

Selectors should not modify state or have side effects. They take state as input and return a derived value.

```ts
// Good - pure selector
const getValue = (state: State) => state.value;

// Bad - mutates state
const getValue = (state: State) => {
  state.value += 1;
  return state.value;
};
```

### Return Stable Types

Use nullable types for optional values so callers know what to expect.

```ts
const getUser = (state: State): User | null => {
  return state._tag === "Ready" ? state.user : null;
};
```

### Select at Component Level

Components should select only the data they need rather than subscribing to entire state objects.

```ts
// Good - select specific data
const userName = useSelector((state) => (state._tag === "Ready" ? state.user.name : null));
```

## See Also

- [Context](22-context.md) - Framework integration with selectors
- [Type Safety](40-type-safety.md) - TypeScript patterns for selectors
