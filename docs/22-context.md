---
category: Features
alias: context
title: Context
description: Framework-agnostic store integration
---

# Context

## Store Context

The store provides methods for integration with any framework:

```ts
const store = createStore(initialState, state, { name: "App" });

// Subscribe to changes
const unsubscribe = store.subscribe((state) => {
  console.log("State changed:", state);
});

// Dispatch actions
store.dispatch("ActionType", payload);

// Query state
const isReady = store.isInState("Ready");
const readyState = store.getState("Ready");
const value = store.select("property");
```

## Framework Integration

### Direct Integration

Access the store directly in components:

```ts
// In any component
const store = getStoreFromContext(); // Framework-specific

// Subscribe
const unsubscribe = store.subscribe((state) => {
  // Update UI based on state
});

// Dispatch
store.dispatch("action", payload);

// Cleanup
unsubscribe();
```

### Reactive Integration

Create reactive wrappers:

```ts
// Vanilla subscription manager
const createSubscriber = (store) => {
  const listeners = new Set();

  const unsubscribe = store.subscribe((state) => {
    listeners.forEach((fn) => fn(state));
  });

  return {
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    dispatch: store.dispatch,
    select: store.select,
  };
};
```

### Selectors in Components

Derive computed values:

```ts
const createSelector = (store, selector) => {
  let current = selector(store.stateValue);

  store.subscribe(() => {
    const next = selector(store.stateValue);
    if (next !== current) {
      current = next;
      notifyListeners();
    }
  });

  return () => current;
};
```

## Store Access Patterns

### Singleton Pattern

Single store for the application:

```ts
// store.ts
export const store = createStore(initialState, state);

// Elsewhere
import { store } from "./store";
store.dispatch("action", payload);
```

### Context Pattern

Provide store through context:

```ts
// Context creation (framework-agnostic)
const TagixContext = {
  Provider: (store, children) => children,
  Consumer: (store, render) => render(store),
};
```

### Dependency Injection

Inject store into components:

```ts
interface AppServices {
  store: TagixStore<State>;
  logger: Logger;
}

const createServices = (): AppServices => ({
  store: createStore(initialState, state),
  logger: new Logger(),
});

// Inject where needed
const service = createServices();
```

## Multiple Stores

Combine multiple stores:

```ts
const authStore = createStore(authInitial, authState);
const dataStore = createStore(dataInitial, dataState);
const uiStore = createStore(uiInitial, uiState);

// Combine in parent
const rootState = taggedEnum({
  Auth: authStore.stateValue,
  Data: dataStore.stateValue,
  UI: uiStore.stateValue,
});
```

## Forking Stores

Create isolated copies for testing:

```ts
const mainStore = createStore(initialState, state);

// Create fork
const testStore = mainStore.fork();

// Test actions
testStore.dispatch("action", payload);

// Verify
expect(testStore.stateValue).toMatchObject({
  /* expected */
});

// Original store unchanged
expect(mainStore.stateValue).toBe(originalState);
```

## Cleanup

Always clean up subscriptions:

```ts
// Good
const unsubscribe = store.subscribe(handler);
return () => unsubscribe();

// Bad - memory leak
store.subscribe(handler);
// No cleanup
```