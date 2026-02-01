---
category: State Management
---

<p align="center">
  <img src="../../../public/tagix-logo.png" alt="Tagix Logo" width="50%" />
</p>

# Pattern Matching

Pattern matching functions for type-safe state handling in Tagix.

## Usage

```ts
import { matchState, exhaust, taggedEnum } from "tagix";

const CounterState = taggedEnum({
  Idle: { value: 0 },
  Loading: {},
  Ready: { value: 0 },
  Error: { message: "" },
});

const store = createStore(CounterState.Ready({ value: 42 }));
```

## matchState()

Non-exhaustive pattern matching. Returns `undefined` for unmatched states.

```ts
const display = matchState(store.stateValue, {
  Idle: () => "Not started",
  Loading: () => "Loading...",
  Ready: (s) => `Count: ${s.value}`,
  Error: (s) => `Error: ${s.message}`,
});

console.log(display); // "Count: 42"
```

**Returns:** Handler return type or `undefined`

### Handle Unmatched States

```ts
const display = matchState(store.stateValue, {
  Idle: () => "Not started",
  Ready: (s) => `Ready: ${s.value}`,
});

// Returns undefined for Loading/Error states
if (display === undefined) {
  console.log("State not handled");
}
```

### Type Safety

```ts
const result = matchState(store.stateValue, {
  Idle: (s) => s.value * 2,
  Ready: (s) => s.value * 3,
});

// result is number | undefined
```

## exhaust()

Exhaustive pattern matching. Throws if a state case is not handled.

```ts
const message = exhaust(store.stateValue, {
  Idle: () => "Not started",
  Loading: () => "Loading...",
  Ready: (s) => `Count: ${s.value}`,
  Error: (s) => `Error: ${s.message}`,
});
```

**Throws:** `NonExhaustiveMatchError` if any state is not covered

### Complete Coverage Required

```ts
// All tags must be handled
exhaust(state, {
  Idle: () => "idle",
  Loading: () => "loading",
  Ready: () => "ready",
  Error: () => "error",
});
```

### Use When

Use `exhaust()` when you want TypeScript to ensure all state variants are handled:

```ts
type State = { _tag: "A" } | { _tag: "B" } | { _tag: "C" };

const result = exhaust(state, {
  A: () => "a",
  B: () => "b",
  C: () => "c",
  // TypeScript error if any tag missing!
});
```

## Complete Example

```ts
import { createStore, matchState, exhaust, taggedEnum } from "tagix";

const TaskState = taggedEnum({
  Pending: { retries: 0 },
  Running: { progress: 0 },
  Completed: { result: null },
  Failed: { error: "" },
});

const store = createStore(TaskState.Running({ progress: 75 }));

// Non-exhaustive with fallback
const status = matchState(store.stateValue, {
  Pending: () => "Waiting to start",
  Running: (s) => `Progress: ${s.progress}%`,
  Completed: () => "Done!",
});

// Exhaustive with guaranteed coverage
const statusMessage = exhaust(store.stateValue, {
  Pending: () => "In progress",
  Running: (s) => `${s.progress}% complete`,
  Completed: () => "Finished",
  Failed: (s) => `Failed: ${s.error}`,
});

// Render UI based on state
const renderTask = (state: typeof store.stateValue) => {
  return (
    matchState(state, {
      Pending: (s) => `<div>Retries: ${s.retries}</div>`,
      Running: (s) => `<div>Progress: ${s.progress}%</div>`,
      Completed: () => `<div>Done</div>`,
      Failed: (s) => `<div>${s.error}</div>`,
    }) || "<div>Unknown state</div>"
  );
};
```

## Comparison

| Feature          | `matchState()`      | `exhaust()`       |
| ---------------- | ------------------- | ----------------- |
| Coverage         | Partial             | Complete          |
| Unmatched states | Returns `undefined` | Throws error      |
| Type safety      | Optional            | Enforced          |
| Use case         | Optional handling   | Required handling |

## Dynamic Patterns

Build patterns dynamically:

```ts
const createStatusMessage = (showDetails: boolean) => {
  return matchState(store.stateValue, {
    Idle: () => "Ready",
    Loading: () => (showDetails ? "Loading..." : "Working"),
    Ready: (s) => (showDetails ? `Done: ${s.value}` : "Done"),
    Error: (s) => (showDetails ? `Error: ${s.message}` : "Failed"),
  });
};
```

## Related

- [taggedEnum](../../lib/Data/tagged-enum.ts) - State definitions
- [when](../guards/index.ts) - Type guards
- [createAction](../actions/index.ts) - State transitions
