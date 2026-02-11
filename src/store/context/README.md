---
category: State Management
---

<p align="center">
  <img src="../../../public/tagix-logo.svg" alt="Tagix Logo" height="128" />
</p>

# TagixContext

Context wrapper around TagixStore with dependency injection, sub-contexts, hook patterns, and subscription management.

## Usage

```ts
import { createStore, createContext, taggedEnum } from "tagix";

const CounterState = taggedEnum({
  Idle: { value: 0 },
  Loading: {},
  Ready: { value: 0 },
  Error: { message: "" },
});

const store = createStore(CounterState.Idle({ value: 0 }), {
  name: "Counter",
});

const context = createContext(store);
```

## API

### createContext(store, config?)

Create a new context from a store.

```ts
const context = createContext(store, {
  parent: null,
  autoCleanup: true,
  onError: (error) => console.error(error),
});
```

**Parameters:**

- `store`: TagixStore instance
- `config` (optional): Context configuration with:
  - `parent`: Parent context for nesting
  - `autoCleanup`: Auto-dispose on cleanup
  - `onError`: Custom error handler for subscription errors

### Properties

| Property     | Type        | Description                       |
| ------------ | ----------- | --------------------------------- |
| `id`         | `ContextId` | Unique context identifier         |
| `storeName`  | `string`    | Name of the underlying store      |
| `isDisposed` | `boolean`   | Whether context has been disposed |

### Methods

#### getCurrent()

Get the current state.

```ts
const state = context.getCurrent();
console.log(state._tag); // 'Idle'
```

**Returns:** Current state

**Throws:** Error if context is disposed

#### getState()

Alias for `getCurrent()`.

```ts
const state = context.getState();
```

#### dispatch(type, payload)

Dispatch an action through the underlying store.

```ts
context.dispatch("tagix/action/Increment", { amount: 5 });

// Async actions return Promise
await context.dispatch("tagix/action/FetchData", {});
```

**Returns:** `void` for sync actions, `Promise<void>` for async actions

**Throws:** Error if context is disposed

#### subscribe(callback)

Subscribe to state changes.

```ts
const unsubscribe = context.subscribe((state) => {
  console.log("State changed:", state);
});

// Later, unsubscribe
unsubscribe();
```

**Returns:** Unsubscribe function

**Throws:** Error if context is disposed

**Note:** Callback runs immediately with current state, then on each change

#### select(selector, callback)

Select a value from state and subscribe to changes.

```ts
context.select(
  (state) => state.value,
  (value) => {
    console.log("Value changed:", value);
  }
);
```

**Parameters:**

- `selector`: Function that extracts value from state
- `callback`: Function called with selected value on changes

**Returns:** Unsubscribe function

**Throws:** Error if context is disposed

#### selectAsync(selector)

Select a value and get a promise that resolves with it.

```ts
const { promise, unsubscribe } = context.selectAsync((state) => state.value);

const value = await promise;
console.log(value); // Current value

unsubscribe();
```

**Returns:** Object with `promise` and `unsubscribe` function

**Throws:** Error if context is disposed

#### subscribeKey(key, callback)

Subscribe to changes of a specific state property.

```ts
context.subscribeKey("_tag", (tag) => {
  console.log("Tag changed:", tag);
});
```

**Parameters:**

- `key`: Property key to subscribe to
- `callback`: Function called when property value changes

**Returns:** Unsubscribe function

#### use()

Access state or a selected value using a hook pattern.

```ts
// Get full state
const state = context.use();

// Get selected value
const value = context.use((state) => state.value);
```

**Returns:** Current state or selected value

**Throws:** Error if context is disposed

#### provide(key, value)

Create a sub-context with a value or a value derived from parent state.

```ts
// Static value
const subContext = context.provide("theme", "dark");

// Derived value from parent state
const subContext = context.provide("derived", (parent) => ({
  doubled: parent.value * 2,
}));
```

**Parameters:**

- `key`: Unique identifier for the provided value
- `value`: Static value or function that derives value from parent state

**Returns:** New sub-context with provided value

**Throws:** Error if context is disposed

#### get(key)

Get a value from the context by key.

```ts
const theme = context.get<string>("theme");
if (theme.isSome) {
  console.log(theme.value); // 'dark'
}
```

**Returns:** `Option<T>` - Some(value) if found, None otherwise

#### clone()

Create a new context that shares the same store.

```ts
const cloned = context.clone();
```

**Returns:** New context instance

**Throws:** Error if context is disposed

**Note:** Clone has its own subscriptions but shares the same store state

#### fork()

Create a forked context that shares the same store.

```ts
const fork = context.fork();
fork.dispatch("tagix/action/Increment", { amount: 10 });

// Changes propagate back to parent
console.log(context.getCurrent().value); // 10
```

**Returns:** New context sharing the same store

**Throws:** Error if context is disposed

**Note:** Fork shares the same store. Changes flow back to the parent.

#### merge(other)

Merge state from another context into this one.

```ts
const otherContext = context.fork();
otherContext.dispatch("tagix/action/Increment", { amount: 5 });

context.merge(otherContext);
```

**Parameters:**

- `other`: The context to merge from

**Throws:** Error if either context is disposed

**Note:** Uses Object.assign to merge state. Subscribers are notified after the merge.

#### dispose()

Clean up the context, removing all subscriptions, child contexts, forks, and derived contexts.

```ts
context.dispose();

// All operations throw after disposal
context.getCurrent(); // Error: "Context has been disposed"
```

**Note:** Safe to call multiple times. Disposes all child contexts, forked contexts, and derived contexts recursively.

## Complete Example

```ts
import { createStore, createContext, createAction, taggedEnum } from "tagix";

const CounterState = taggedEnum({
  Idle: { value: 0 },
  Loading: {},
  Ready: { value: 0 },
  Error: { message: "" },
});

const store = createStore(CounterState.Idle({ value: 0 }), {
  name: "Counter",
});

const context = createContext(store);

// Register action
const increment = createAction<{ amount: number }, typeof CounterState.State>("Increment")
  .withPayload({ amount: 1 })
  .withState((s, p) => {
    const state = s as Extract<typeof CounterState.State, { value: number }>;
    return { ...s, value: state.value + p.amount };
  });

store.register("Increment", increment);

// Subscribe to state changes
context.subscribe((state) => {
  console.log("State:", state._tag);
});

// Select specific value
context.select(
  (state) => {
    if ("value" in state && typeof state.value === "number") {
      return state.value;
    }
    return 0;
  },
  (value) => {
    console.log("Value:", value);
  }
);

// Dispatch actions
context.dispatch("tagix/action/Increment", { amount: 5 });
```

## Dependency Injection

Inject values into sub-contexts with `provide`:

```ts
// Provide static value
const userContext = context.provide("user", {
  name: "Chris",
  role: "admin",
});

// Provide derived value
const computedContext = context.provide("computed", (parent) => ({
  doubled: parent.value * 2,
  squared: parent.value ** 2,
}));

// Access provided values
const user = userContext.get<{ name: string; role: string }>("user");
if (user.isSome) {
  console.log(user.value.name); // 'Chris'
}
```

## Hook Pattern

Use `use()` to access state or selected values:

```ts
// Get full state
const state = context.use();

// Get selected value
const value = context.use((state) => {
  if ("value" in state && typeof state.value === "number") {
    return state.value;
  }
  return 0;
});
```

## Forking and Merging

Create separate branches of state:

```ts
// Fork current state
const fork = context.fork();

// Make changes in fork
fork.dispatch("tagix/action/Increment", { amount: 100 });

// Fork is tracked and disposed with parent
context.dispose(); // fork is also disposed

// Parent context now has merged state
console.log(context.getCurrent().value); // 100
```

## Async Selection

Get values as promises:

```ts
const { promise, unsubscribe } = context.selectAsync((state) => {
  if ("value" in state && typeof state.value === "number") {
    return state.value;
  }
  return 0;
});

const value = await promise;
console.log(value); // Current value

unsubscribe();
```

## Cleanup

Clean up contexts when you're done:

```ts
// Manual disposal
context.dispose();

// Or use Symbol.dispose (if supported)
{
  using ctx = context as unknown as { [Symbol.dispose]: () => void } & typeof context;
  // Use context
  ctx.dispose();
}
```

## Error Handling

Configure custom error handling for subscription errors:

```ts
const context = createContext(store, {
  onError: (error) => {
    console.error("Context error:", error);
    // Report to error tracking service
  },
});

// Subscription errors are passed to the handler
context.subscribe((state) => {
  if (someCondition) {
    throw new Error("Custom error");
  }
});
```

## Related

- [createStore](../core/factory.ts) - Store creation
- [createAction](../actions/index.ts) - Synchronous actions
- [createAsyncAction](../actions/index.ts) - Async actions
- [select](../selectors/index.ts) - Selector utilities
