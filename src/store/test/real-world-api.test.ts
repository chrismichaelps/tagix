import { describe, it, expect, vi } from "vitest";
import {
  createStore,
  createAsyncAction,
  createSlice,
  bindActions,
  createContext,
  createServiceTag,
  persist,
  taggedEnum,
  type StorageLike,
} from "../index";

/**
 * Real-world integration tests that drive the public API against a live HTTP
 * API (JSONPlaceholder). These exercise the async/effect/error/retry machinery,
 * service+context threading, persistence, and concurrency over real I/O —
 * surfacing timing/merge bugs that mocked effects can hide.
 *
 * Network-dependent; each test uses a generous timeout.
 */

const BASE = "https://jsonplaceholder.typicode.com";
const TIMEOUT = 20000;

describe("real-world API: createSlice async", () => {
  const Users = taggedEnum({
    Idle: {},
    Loading: {},
    Loaded: { count: 0 },
    Failed: { message: "" },
  });
  type UsersType = typeof Users.State;

  it(
    "loads users over HTTP and stores the count via a bound async action",
    async () => {
      const slice = createSlice({
        state: Users.Idle({}),
        schema: Users,
        actions: {
          load: createAsyncAction<void, UsersType, unknown[]>("Load")
            .state(() => Users.Loading({}))
            .effect(async () => {
              const res = await fetch(`${BASE}/users`);
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              return (await res.json()) as unknown[];
            })
            .onSuccess((_s, users) => Users.Loaded({ count: users.length }))
            .onError((_s, e) => Users.Failed({ message: String(e) })),
        },
      });

      await slice.actions.load();

      expect(slice.store.stateValue._tag).toBe("Loaded");
      expect((slice.store.stateValue as Extract<UsersType, { count: number }>).count).toBe(10);
    },
    TIMEOUT
  );

  it(
    "routes a real 404 into onError",
    async () => {
      const slice = createSlice({
        state: Users.Idle({}),
        schema: Users,
        actions: {
          load: createAsyncAction<void, UsersType, unknown[]>("Load")
            .state(() => Users.Loading({}))
            .effect(async () => {
              const res = await fetch(`${BASE}/this-endpoint-does-not-exist`);
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              return (await res.json()) as unknown[];
            })
            .onSuccess((_s, users) => Users.Loaded({ count: users.length }))
            .onError((_s, e) => Users.Failed({ message: String(e) })),
        },
      });

      await slice.actions.load();

      expect(slice.store.stateValue._tag).toBe("Failed");
      expect((slice.store.stateValue as Extract<UsersType, { message: string }>).message).toMatch(
        /404/
      );
    },
    TIMEOUT
  );
});

describe("real-world API: bindActions async + POST with payload", () => {
  const Post = taggedEnum({
    Idle: {},
    Created: { id: 0, title: "" },
    Failed: { message: "" },
  });
  type PostType = typeof Post.State;

  it(
    "POSTs a payload and stores the created resource",
    async () => {
      const store = createStore(Post.Idle({}), Post);
      const create = createAsyncAction<{ title: string; body: string }, PostType, { id: number }>(
        "Create"
      )
        .state((s) => ({ ...s }))
        .effect(async (payload) => {
          const res = await fetch(`${BASE}/posts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload, userId: 1 }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return (await res.json()) as { id: number };
        })
        .onSuccess((_s, created) => Post.Created({ id: created.id, title: "ok" }))
        .onError((_s, e) => Post.Failed({ message: String(e) }));

      const actions = bindActions(store, { create });
      await actions.create({ title: "hello", body: "world" });

      expect(store.stateValue._tag).toBe("Created");
      // JSONPlaceholder echoes a created id of 101 for new posts.
      expect((store.stateValue as Extract<PostType, { id: number }>).id).toBe(101);
    },
    TIMEOUT
  );
});

describe("real-world API: services + context threading", () => {
  const Profile = taggedEnum({
    Idle: {},
    Ready: { name: "" },
    Failed: { message: "" },
  });
  type ProfileType = typeof Profile.State;

  it(
    "resolves an HTTP client service in effect and a logger in onSuccess",
    async () => {
      const Api = createServiceTag<{ getUser: (id: number) => Promise<{ name: string }> }>("Api");
      const Logger = createServiceTag<{ info: (msg: string) => void }>("Logger");

      const fetchProfile = createAsyncAction<{ id: number }, ProfileType, { name: string }>(
        "FetchProfile"
      )
        .state(() => Profile.Idle({}))
        .effect((payload, ctx) => ctx.getService(Api).getUser(payload.id))
        .onSuccess((_s, user, ctx) => {
          ctx.getService(Logger).info(`loaded ${user.name}`);
          return Profile.Ready({ name: user.name });
        })
        .onError((_s, e) => Profile.Failed({ message: String(e) }));

      const store = createStore(Profile.Idle({}), Profile);
      store.register("FetchProfile", fetchProfile);
      const ctx = createContext(store);

      const logger = { info: vi.fn() };
      ctx.provideService(Api, {
        getUser: async (id) => {
          const res = await fetch(`${BASE}/users/${id}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return (await res.json()) as { name: string };
        },
      });
      ctx.provideService(Logger, logger);

      await ctx.dispatch(fetchProfile, { id: 1 });

      expect(store.stateValue._tag).toBe("Ready");
      const name = (store.stateValue as Extract<ProfileType, { name: string }>).name;
      expect(name).toBe("Leanne Graham"); // user 1 on JSONPlaceholder
      expect(logger.info).toHaveBeenCalledWith("loaded Leanne Graham");
    },
    TIMEOUT
  );
});

describe("real-world API: retry against live failures", () => {
  const Data = taggedEnum({
    Idle: {},
    Loading: {},
    Ready: { title: "" },
    Failed: { message: "" },
  });
  type DataType = typeof Data.State;

  it(
    "exhausts retries on a persistent 404 and records one error",
    async () => {
      let attempts = 0;
      const store = createStore(Data.Idle({}), Data, { maxRetries: 2 });
      const load = createAsyncAction<void, DataType, { title: string }>("Load")
        .state(() => Data.Loading({}))
        .effect(async () => {
          attempts++;
          const res = await fetch(`${BASE}/nope-${attempts}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return (await res.json()) as { title: string };
        })
        .onSuccess((_s, d) => Data.Ready({ title: d.title }))
        .onError((_s, e) => Data.Failed({ message: String(e) }));
      store.register("Load", load);

      await store.dispatch(load, undefined);

      expect(attempts).toBe(3); // 1 initial + 2 retries
      expect(store.stateValue._tag).toBe("Failed");
      expect(store.getTotalErrorCount()).toBe(1);
    },
    TIMEOUT
  );

  it(
    "recovers when a retry succeeds after a transient failure",
    async () => {
      let attempts = 0;
      const store = createStore(Data.Idle({}), Data, { maxRetries: 3 });
      const load = createAsyncAction<void, DataType, { title: string }>("Load")
        .state(() => Data.Loading({}))
        .effect(async () => {
          attempts++;
          // First attempt hits a bad path (404), subsequent attempts succeed.
          const path = attempts === 1 ? "bad-path" : "todos/1";
          const res = await fetch(`${BASE}/${path}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return (await res.json()) as { title: string };
        })
        .onSuccess((_s, d) => Data.Ready({ title: d.title }))
        .onError((_s, e) => Data.Failed({ message: String(e) }));
      store.register("Load", load);

      await store.dispatch(load, undefined);

      expect(attempts).toBe(2);
      expect(store.stateValue._tag).toBe("Ready");
      expect((store.stateValue as Extract<DataType, { title: string }>).title.length).toBeGreaterThan(
        0
      );
    },
    TIMEOUT
  );
});

describe("real-world API: concurrent requests merge onto fresh state", () => {
  const Dash = taggedEnum({ Active: { users: 0, posts: 0 } });
  type DashType = typeof Dash.State;

  it(
    "lands both results when two requests resolve concurrently",
    async () => {
      const store = createStore(Dash.Active({ users: 0, posts: 0 }), Dash);

      const count = (path: string) =>
        createAsyncAction<void, DashType, number>(`Count-${path}`)
          .state((s) => ({ ...s }))
          .effect(async () => {
            const res = await fetch(`${BASE}/${path}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return ((await res.json()) as unknown[]).length;
          });

      const fetchUsers = count("users")
        .onSuccess((fresh, n) => Dash.Active({ ...(fresh as DashType), users: n }))
        .onError((s) => s);
      const fetchPosts = count("posts")
        .onSuccess((fresh, n) => Dash.Active({ ...(fresh as DashType), posts: n }))
        .onError((s) => s);

      store.register("Users", fetchUsers);
      store.register("Posts", fetchPosts);

      await Promise.all([store.dispatch(fetchUsers, undefined), store.dispatch(fetchPosts, undefined)]);

      const final = store.stateValue as DashType;
      // Both onSuccess handlers must merge onto fresh state — neither clobbers the other.
      expect(final.users).toBe(10);
      expect(final.posts).toBe(100);
    },
    TIMEOUT
  );
});

describe("real-world API: persist a fetched result across instances", () => {
  const Users = taggedEnum({ Idle: {}, Loaded: { count: 0 } });
  type UsersType = typeof Users.State;

  function memoryStorage(): StorageLike & { data: Record<string, string> } {
    const data: Record<string, string> = {};
    return {
      data,
      getItem: (k) => (k in data ? data[k] : null),
      setItem: (k, v) => {
        data[k] = v;
      },
      removeItem: (k) => {
        delete data[k];
      },
    };
  }

  it(
    "persists a fetched count and rehydrates a fresh store from it",
    async () => {
      const storage = memoryStorage();

      const store1 = createStore(Users.Idle({}), Users);
      persist(store1, { key: "users", storage });
      const load = createAsyncAction<void, UsersType, number>("Load")
        .state((s) => ({ ...s }))
        .effect(async () => {
          const res = await fetch(`${BASE}/users`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return ((await res.json()) as unknown[]).length;
        })
        .onSuccess((_s, n) => Users.Loaded({ count: n }))
        .onError((s) => s);
      store1.register("Load", load);

      await store1.dispatch(load, undefined);
      expect((store1.stateValue as Extract<UsersType, { count: number }>).count).toBe(10);

      // A fresh store hydrates from the persisted snapshot — no refetch.
      const store2 = createStore(Users.Idle({}), Users);
      persist(store2, { key: "users", storage });
      expect(store2.stateValue._tag).toBe("Loaded");
      expect((store2.stateValue as Extract<UsersType, { count: number }>).count).toBe(10);
    },
    TIMEOUT
  );
});
