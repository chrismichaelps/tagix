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
const store = createStore(CounterState.Idle({ value: 0 }));

// Get a specific property from state
const value = store.select("value");

// Check if the current state matches a tag
if (store.isInState("Ready")) {
  // State is Ready
}

// Get state wrapped in an Option type
const readyState = store.getState("Ready");
if (readyState.isSome) {
  // Access readyState.value
}
```

## Built-in Selector Functions

Tagix provides several selector utilities that work with any state object.

### select

Extract a single property from an object.

```ts
import { select } from "tagix";

const state = { value: 42, name: "test", _tag: "Ready" };

select(state, "value"); // 42
select(state, "name"); // "test"
select(state, "missing"); // undefined
```

### pluck

Create a curried selector function. This is useful when you want to reuse the same selector across multiple components.

```ts
import { pluck } from "tagix";

const state = { value: 42, _tag: "Ready" };

const getValue = pluck("value");
getValue(state); // 42

const getTag = pluck("_tag");
getTag(state); // "Ready"
```

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
// { value: 5, name: "test", active: false }
```

Chain multiple patches together.

```ts
const base = { x: 1, y: 2, z: 3 };

const update = patch(base);
const result = update({ x: 10 })({ y: 20 });
// { x: 10, y: 20, z: 3 }
```

### getOrDefault

Provide a default value when a selector returns undefined.

```ts
import { getOrDefault } from "tagix";

const getter = (input: { value?: number }) => input.value;

const withDefault = getOrDefault(0);
withDefault({ value: 5 }); // 5
withDefault({ value: undefined }); // 0
withDefault({}); // 0
```

## Complete Example

```ts
import { createStore, select, pluck, memoize, combineSelectors, patch, taggedEnum } from "tagix";

const UserState = taggedEnum({
  Idle: { user: null },
  Loading: {},
  Ready: { user: { name: string; email: string; age: number } },
  Error: { message: string },
});

const store = createStore(
  UserState.Ready({
    user: { name: "Chris", email: "chris@test.com", age: 30 },
  })
);

// Simple selection
const userName = select(store.stateValue.user, "name");
// "Chris"

// Curried selector
const getUserName = pluck("user.name");
const name = getUserName(store.stateValue);
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
const updateUser = patch(store.stateValue.user)({ age: 31 });
```

## Selector Patterns

### Derived State

Build derived values from your state.

```ts
const getFullName = (user: { first: string; last: string }) => `${user.first} ${user.last}`;

const getUserData = combineSelectors(pluck("firstName"), pluck("lastName"), getFullName);
```

### Conditional Selection

Handle optional values gracefully.

```ts
const getDisplayName = (user: { displayName?: string; username: string }) => {
  const display = select(user, "displayName");
  return display ?? user.username;
};
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
