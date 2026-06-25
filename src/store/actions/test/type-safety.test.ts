import { describe, it, expect, expectTypeOf } from "vitest";
import { createStore, createAsyncAction, createSlice, taggedEnum } from "../../index";

interface User {
  readonly id: number;
  readonly name: string;
  readonly email: string;
}

const UserState = taggedEnum({
  Idle: {},
  Loading: {},
  Ready: { user: null as User | null },
  Failed: { message: "" },
});
type UserStateType = typeof UserState.State;

describe("async action type-safety: effect result flows into onSuccess", () => {
  it("infers onSuccess result from the effect return without an explicit TEffect", () => {
    createAsyncAction<{ id: number }, UserStateType>("Fetch")
      .state(() => UserState.Loading({}))
      .effect(async () => ({ name: "Ada", age: 36 }))
      .onSuccess((_s, result) => {
        // result is the concrete effect return — not `unknown`.
        expectTypeOf(result).toEqualTypeOf<{ name: string; age: number }>();
        expectTypeOf(result).not.toBeUnknown();
        return UserState.Ready({ user: { id: 1, name: result.name, email: "" } });
      })
      .onError((s) => s);
  });

  it("threads a typed fetch response through to onSuccess (production pattern)", () => {
    createAsyncAction<{ id: number }, UserStateType>("FetchUser")
      .state(() => UserState.Loading({}))
      .effect(async (payload): Promise<User> => {
        // payload is typed, not `any`/`unknown`
        expectTypeOf(payload).toEqualTypeOf<{ id: number }>();
        const res = await fetch(`https://example.test/users/${payload.id}`);
        return (await res.json()) as User;
      })
      .onSuccess((_s, user) => {
        expectTypeOf(user).toEqualTypeOf<User>();
        expectTypeOf(user).not.toBeUnknown();
        // Field access is type-checked — `user.name` is `string`.
        expectTypeOf(user.name).toEqualTypeOf<string>();
        return UserState.Ready({ user });
      })
      .onError((s) => s);
  });

  it("pins the result type via an annotated effect return", () => {
    createAsyncAction<void, UserStateType>("FetchUser")
      .state(() => UserState.Loading({}))
      .effect(async (): Promise<User> => ({ id: 1, name: "Ada", email: "a@b.com" }))
      .onSuccess((_s, user) => {
        expectTypeOf(user).toEqualTypeOf<User>();
        return UserState.Ready({ user });
      })
      .onError((s) => s);
  });

  it("infers array element types from the effect return", () => {
    createAsyncAction<void, UserStateType>("FetchUsers")
      .state(() => UserState.Loading({}))
      .effect(async (): Promise<User[]> => {
        const res = await fetch("https://example.test/users");
        return (await res.json()) as User[];
      })
      .onSuccess((_s, users) => {
        expectTypeOf(users).toEqualTypeOf<User[]>();
        const first: User | undefined = users[0];
        return UserState.Ready({ user: first ?? null });
      })
      .onError((s) => s);
  });

  it("preserves typing for async actions declared inside createSlice", () => {
    const slice = createSlice({
      state: UserState.Idle({}),
      schema: UserState,
      actions: {
        load: createAsyncAction<{ id: number }, UserStateType>("Load")
          .state(() => UserState.Loading({}))
          .effect(async (): Promise<User> => ({ id: 1, name: "Ada", email: "a@b.com" }))
          .onSuccess((_s, user) => {
            expectTypeOf(user).toEqualTypeOf<User>();
            return UserState.Ready({ user });
          })
          .onError((s) => s),
      },
    });

    // The bound dispatcher's payload type is inferred and required.
    expectTypeOf(slice.actions.load).toEqualTypeOf<(payload: { id: number }) => Promise<void>>();
  });

  it("runs the typed flow end to end (runtime check of the inferred path)", async () => {
    const store = createStore(UserState.Idle({}), UserState);
    const load = createAsyncAction<{ id: number }, UserStateType>("Load")
      .state(() => UserState.Loading({}))
      .effect(async (p): Promise<User> => ({ id: p.id, name: "Ada", email: "a@b.com" }))
      .onSuccess((_s, user) => UserState.Ready({ user }))
      .onError((s) => s);
    store.register("Load", load);

    await store.dispatch(load, { id: 7 });

    expect(store.stateValue._tag).toBe("Ready");
    const ready = store.stateValue as Extract<UserStateType, { user: User | null }>;
    expect(ready.user?.id).toBe(7);
    expect(ready.user?.name).toBe("Ada");
  });
});
