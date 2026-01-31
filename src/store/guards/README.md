---
category: State Management
---

<p align="center">
  <img src="../../../public/tagix-logo.png" alt="Tagix Logo" width="50%" />
</p>

# Guards

Type guards for state type refinement and conditional state extraction in Tagix.

## Usage

```ts
import { when, on, withState, getTag, isInState, taggedEnum } from "tagix";

const CounterState = taggedEnum({
  Idle: { value: 0 },
  Loading: {},
  Ready: { value: 0 },
  Error: { message: "" },
});

const store = createStore(CounterState.Ready({ value: 42 }));
```

## when()

Type guard that returns `true` if state matches the given tag. Enables TypeScript type narrowing.

```ts
if (when("Ready")(store.stateValue)) {
  // store.stateValue is narrowed to Ready state
  console.log(store.stateValue.value); // ✅ TypeScript knows this exists
}
```

**Returns:** `boolean`

### Examples

```ts
const state = store.stateValue;

when("Ready")(state); // true if _tag === 'Ready'
when("Idle")(state); // true if _tag === 'Idle'
when("Loading")(state); // true if _tag === 'Loading'
when("Error")(state); // true if _tag === 'Error'
```

### Type Narrowing

```ts
const state = store.stateValue;

if (when("Ready")(state)) {
  // state is now typed as { readonly _tag: 'Ready'; value: number }
  console.log(state.value * 2);
}
```

## on()

Extract a handler for a specific state tag, returning `undefined` for non-matching states.

```ts
const handlers = {
  Idle: (s) => s.value * 2,
  Ready: (s) => s.value * 3,
  Loading: () => 0,
  Error: () => -1,
};

const result = on("Ready")(handlers.Ready)(store.stateValue);
// result: number | undefined
```

### Examples

```ts
const double = on("Ready")((s) => s.value * 2);
const result = double(store.stateValue);
// result is number if Ready, undefined otherwise
```

## withState()

Execute a callback only if state matches the tag.

```ts
const result = withState(store.stateValue, "Ready", (s) => s.value * 10);
// result: number | undefined
```

**Returns:** Callback result or `undefined` if tag doesn't match

```ts
// Safe extraction
const value = withState(store.stateValue, "Ready", (s) => s.value);
if (value !== undefined) {
  console.log(value * 2); // Safe to use
}
```

## getTag()

Get the state's `_tag` value.

```ts
const tag = getTag(store.stateValue);
// tag: 'Idle' | 'Loading' | 'Ready' | 'Error'
```

## isInState()

Check if the store's current state matches a given tag.

```ts
store.isInState("Ready"); // true/false
store.isInState("Idle"); // true/false
```

**Shorthand for:**

```ts
store.stateValue._tag === "Ready";
```

## hasTag()

Check if any state has a specific tag.

```ts
hasTag(state, "Ready"); // boolean
```

## Complete Example

```ts
import { createStore, when, on, withState, getTag, isInState, taggedEnum } from "tagix";

const AppState = taggedEnum({
  Idle: { data: null },
  Loading: { progress: 0 },
  Success: { data: [] },
  Error: { message: "" },
});

const store = createStore(AppState.Loading({ progress: 50 }));

// Conditional rendering with when()
if (when("Loading")(store.stateValue)) {
  console.log("Loading:", store.stateValue.progress);
}

// Extract handler with on()
const progressHandler = on("Loading")((s) => s.progress * 2);
const doubled = progressHandler(store.stateValue);

// Safe extraction with withState()
const progress = withState(store.stateValue, "Loading", (s) => s.progress);

// Get current tag
const currentTag = getTag(store.stateValue);
console.log("Current state:", currentTag);

// Check store state
if (isInState(store, "Loading")) {
  console.log("Still loading...");
}
```

## Comparison Table

| Function                    | Purpose               | Returns          |
| --------------------------- | --------------------- | ---------------- |
| `when(tag)`                 | Type guard            | `boolean`        |
| `on(tag)(handler)`          | Handler extraction    | `R \| undefined` |
| `withState(state, tag, fn)` | Conditional execution | `R \| undefined` |
| `getTag(state)`             | Get tag value         | `S['_tag']`      |
| `isInState(store, tag)`     | Check store state     | `boolean`        |
| `hasTag(state, tag)`        | Check any state       | `boolean`        |

## Related

- [taggedEnum](../../lib/Data/tagged-enum.ts) - State definitions
- [matchState](../match/index.ts) - Pattern matching
- [createAction](../actions/index.ts) - State transitions
