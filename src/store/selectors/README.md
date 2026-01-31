---
category: State Management
---

<p align="center">
  <img src="../../../public/tagix-logo.png" alt="Tagix Logo" width="50%" />
</p>

# Selectors

Selector functions for extracting and transforming state data in Tagix.

## Usage

```ts
import { select, pluck, memoize, combineSelectors, patch, getOrDefault } from "tagix";
```

## select()

Get a property value from an object.

```ts
const state = { value: 42, name: "test", _tag: "Ready" };

select(state, "value"); // 42
select(state, "name"); // 'test'
select(state, "missing"); // undefined
```

**Parameters:**

- `obj`: Source object
- `key`: Property key to extract

**Returns:** Property value or `undefined`

## pluck()

Curried property selector. Returns a function that extracts the property.

```ts
const state = { value: 42, _tag: "Ready" };

const getValue = pluck("value");
getValue(state); // 42

const getTag = pluck("_tag");
getTag(state); // 'Ready'
```

**Returns:** `(obj: T) => T[K] | undefined`

### Use with Store

```ts
const getValue = pluck("value");
const currentValue = getValue(store.stateValue);
```

## memoize()

Cache selector results to avoid recomputation.

```ts
let callCount = 0;

const expensiveSelector = memoize((input: { value: number }) => {
  callCount++;
  return input.value * 2;
});

const obj = { value: 5 };

expensiveSelector(obj); // 10, callCount = 1
expensiveSelector(obj); // 10 (cached), callCount = 1
expensiveSelector({ value: 5 }); // 10 (new reference), callCount = 2
```

**Parameters:**

- `selector`: Function to memoize

**Returns:** Memoized function with same signature

## combineSelectors()

Combine multiple selectors into one.

```ts
const getValue = (s: { value: number }) => s.value;
const getTag = (s: { _tag: string }) => s._tag;

const combined = combineSelectors(getValue, getTag);

const state = { value: 42, _tag: "Ready" };
const [value, tag] = combined(state);
// value: 42, tag: 'Ready'
```

### Three or More Selectors

```ts
const getValue = (s: { value: number }) => s.value;
const getTag = (s: { _tag: string }) => s._tag;
const getActive = (s: { active: boolean }) => s.active;

const combined = combineSelectors(getValue, getTag, getActive);

const [value, tag, active] = combined({
  value: 10,
  _tag: "Ready",
  active: true,
});
// value: 10, tag: 'Ready', active: true
```

## patch()

Create an immutable update by spreading base object with updates.

```ts
const base = { value: 0, name: "test", active: true };

const updated = patch(base)({ value: 5, active: false });
// { value: 5, name: 'test', active: false }
```

**Parameters:**

- `base`: Base object

**Returns:** Function accepting partial updates

### Chained Updates

```ts
const base = { x: 1, y: 2, z: 3 };

const update = patch(base);
const result = update({ x: 10 })({ y: 20 });
// { x: 10, y: 20, z: 3 }
```

## getOrDefault()

Provide a default value for undefined results.

```ts
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
  Ready: { user: { name: "", email: "", age: 0 } },
  Error: { message: "" },
});

const store = createStore(
  UserState.Ready({
    user: { name: "Alice", email: "alice@test.com", age: 30 },
  })
);

// Simple selection
const userName = select(store.stateValue.user, "name");
// 'Alice'

// Curried selector
const getUserName = pluck("user.name");
const name = getUserName(store.stateValue);
// 'Alice'

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

```ts
const getFullName = (user: { first: string; last: string }) => `${user.first} ${user.last}`;

const getUserData = combineSelectors(pluck("firstName"), pluck("lastName"), getFullName);
```

### Conditional Selection

```ts
const getDisplayName = (user: { displayName?: string; username: string }) => {
  const display = select(user, "displayName");
  return display ?? user.username;
};
```

### Reactivity with Memoization

```ts
const expensiveTransform = memoize((data: { items: number[] }) => {
  return data.items.reduce((sum, item) => sum + item, 0);
});
```

## Related

- [taggedEnum](../../lib/Data/tagged-enum.ts) - State definitions
- [createStore](../core/factory.ts) - Store methods
- [when](../guards/index.ts) - Type guards
