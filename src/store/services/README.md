---
category: State Management
---

<p align="center">
<img src="../../../public/tagix-logo.svg" alt="Tagix Logo" height="128" />
</p>

# Service System

Type-safe dependency injection system for Tagix actions. Services allow you to inject and access external dependencies (like APIs, loggers, databases) within action handlers.

## createServiceTag

Creates a typed service identifier. Service tags are cached by name — calling `createServiceTag` with the same name returns the same tag instance.

```ts
const Database = createServiceTag<{ query: (sql: string) => unknown[] }>("Database");
const Logger = createServiceTag<{ info: (msg: string) => void; error: (msg: string) => void }>(
  "Logger"
);
```

## createServiceRegistry

Creates an organized group of service tags. Useful for grouping related services.

```ts
const Services = createServiceRegistry({
  database: Database,
  logger: Logger,
});

// Access tags through the registry
const dbTag = Services.database;
const logTag = Services.logger;
```

## Context Service Methods

Services are provided and retrieved through a TagixContext:

### provideService

Injects a service implementation into the context.

```ts
context.provideService(Database, {
  query(sql) {
    return [{ id: 1 }];
  },
});
```

Returns the context for chaining:

```ts
context.provideService(Database, dbImpl).provideService(Logger, loggerImpl);
```

### getService

Retrieves a required service. Throws if the service is not provided.

```ts
const db = context.getService(Database);
const results = db.query("SELECT * FROM users");
```

### getServiceOptional

Retrieves an optional service. Returns `undefined` if not provided.

```ts
const analytics = context.getServiceOptional(Analytics);
if (analytics) {
  analytics.track("user_login", { userId: "123" });
}
```

---

## Complete Example

```ts
import { createContext, createStore, createAction, taggedEnum } from "tagix";
import { createServiceTag, createServiceRegistry } from "tagix";

const UserState = taggedEnum({
  Idle: {},
  Loading: {},
  Loaded: { users: [] as { id: number; name: string }[] },
  Error: { message: "" },
});

const Api = createServiceTag<{ fetchUsers: () => Promise<{ id: number; name: string }[]> }>("Api");
const Logger = createServiceTag<{ info: (msg: string) => void; error: (msg: string) => void }>(
  "Logger"
);

const loadUsers = createAction("LoadUsers").withHandler(async (state, _, ctx) => {
  const api = ctx.getService(Api);
  const logger = ctx.getService(Logger);

  logger.info("Loading users...");

  try {
    const users = await api.fetchUsers();
    return { ...state, users, _tag: "Loaded" };
  } catch (error) {
    logger.error(`Failed: ${error}`);
    return { ...state, message: String(error), _tag: "Error" };
  }
});

const store = createStore(UserState.Idle({}), UserState);
const context = createContext(store);

context.provideService(Api, {
  async fetchUsers() {
    return [{ id: 1, name: "Chris" }];
  },
});

context.provideService(Logger, {
  info(msg) {
    console.log(msg);
  },
  error(msg) {
    console.error(msg);
  },
});

store.register("LoadUsers", loadUsers);
context.dispatch(loadUsers, {});
```

## Service Registry Pattern

Group related services for cleaner architecture:

```ts
const Services = createServiceRegistry({
  database: createServiceTag<DatabaseService>("Database"),
  cache: createServiceTag<CacheService>("Cache"),
  logger: createServiceTag<LoggerService>("Logger"),
});

// Later access via registry
const db = context.getService(Services.database);
```

---

## Related

- [createContext](../context/index.ts) - Create a context from a store
- [createAction](../actions/index.ts) - Create actions with service integration
- [createStore](../core/factory.ts) - Create a store instance
