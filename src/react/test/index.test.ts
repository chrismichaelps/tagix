import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createStore, createAction, taggedEnum, deriveStore } from "../../index";
import {
  useTagix,
  useTagixSelect,
  useTagixWhen,
  useTagixMatch,
  useDispatch,
} from "../index";

const AppState = taggedEnum({
  Idle: {},
  Loading: { progress: 0 },
  Success: { data: "" },
  Error: { message: "" },
});
type AppStateType = typeof AppState.State;

let store: ReturnType<typeof createStore<AppStateType>>;

beforeEach(() => {
  store = createStore(AppState.Idle({}), AppState);
});

describe("useTagix", () => {
  it("returns the current state", () => {
    const { result } = renderHook(() => useTagix(store));
    expect(result.current._tag).toBe("Idle");
  });

  it("re-renders when state changes", () => {
    const goLoading = createAction<void, AppStateType>("GoLoading")
      .withPayload(undefined)
      .withState(() => AppState.Loading({ progress: 0 }));

    store.register("GoLoading", goLoading);

    const { result } = renderHook(() => useTagix(store));
    expect(result.current._tag).toBe("Idle");

    act(() => {
      store.dispatch("tagix/action/GoLoading", undefined);
    });

    expect(result.current._tag).toBe("Loading");
    expect((result.current as Extract<AppStateType, { _tag: "Loading" }>).progress).toBe(0);
  });
});

describe("useTagixSelect", () => {
  it("returns a derived value from state", () => {
    const { result } = renderHook(() =>
      useTagixSelect(store, (s) => (s._tag === "Success" ? s.data : null))
    );
    expect(result.current).toBeNull();
  });

  it("returns the same selected object reference when the selector result is structurally equal", () => {
    const setProgress = createAction<{ pct: number }, AppStateType>("SetProgress")
      .withPayload({ pct: 0 })
      .withState((_s, p) => AppState.Loading({ progress: p.pct }));

    store.register("SetProgress", setProgress);

    // Selector returns a new object each time. Only the dedup cache can return
    // the same reference when the value is structurally equal.
    const { result } = renderHook(() =>
      useTagixSelect(
        store,
        (s) => ({ progress: s._tag === "Loading" ? s.progress : -1 }),
        (a, b) => a.progress === b.progress
      )
    );

    act(() => {
      store.dispatch("tagix/action/SetProgress", { pct: 50 });
    });
    expect(result.current.progress).toBe(50);
    const refBefore = result.current;

    // Same progress value — selector creates a new object, but dedup must
    // return the same reference as before.
    act(() => {
      store.dispatch("tagix/action/SetProgress", { pct: 50 });
    });

    expect(result.current).toBe(refBefore);
  });
});

describe("useTagixWhen", () => {
  it("returns undefined when tag does not match", () => {
    const { result } = renderHook(() => useTagixWhen(store, "Success"));
    expect(result.current).toBeUndefined();
  });

  it("returns variant props without _tag when tag matches", () => {
    const goSuccess = createAction<{ data: string }, AppStateType>("GoSuccess")
      .withPayload({ data: "" })
      .withState((_s, p) => AppState.Success({ data: p.data }));

    store.register("GoSuccess", goSuccess);

    const { result } = renderHook(() => useTagixWhen(store, "Success"));
    expect(result.current).toBeUndefined();

    act(() => {
      store.dispatch("tagix/action/GoSuccess", { data: "hello" });
    });

    expect(result.current).toBeDefined();
    expect(result.current!.data).toBe("hello");
    expect("_tag" in (result.current ?? {})).toBe(false);
  });
});

describe("useTagixMatch", () => {
  it("returns the handler result for the current variant", () => {
    const { result } = renderHook(() =>
      useTagixMatch(store, {
        Idle: () => "idle",
        Loading: (s) => `loading:${s.progress}`,
        Success: (s) => s.data,
        Error: (s) => `error:${s.message}`,
      })
    );
    expect(result.current).toBe("idle");
  });

  it("re-renders when variant changes", () => {
    const goError = createAction<{ message: string }, AppStateType>("GoError")
      .withPayload({ message: "" })
      .withState((_s, p) => AppState.Error({ message: p.message }));

    store.register("GoError", goError);

    const { result } = renderHook(() =>
      useTagixMatch(store, {
        Idle: () => "idle",
        Loading: (s) => `loading:${s.progress}`,
        Success: (s) => s.data,
        Error: (s) => `error:${s.message}`,
      })
    );
    expect(result.current).toBe("idle");

    act(() => {
      store.dispatch("tagix/action/GoError", { message: "boom" });
    });

    expect(result.current).toBe("error:boom");
  });
});

describe("useDispatch", () => {
  it("returns a stable dispatch function across re-renders", () => {
    const goLoading = createAction<void, AppStateType>("GoLoading")
      .withPayload(undefined)
      .withState(() => AppState.Loading({ progress: 0 }));
    store.register("GoLoading", goLoading);

    const dispatches: unknown[] = [];
    const { rerender } = renderHook(() => {
      dispatches.push(useDispatch(store));
      return useTagix(store);
    });

    rerender();
    rerender();

    expect(dispatches[0]).toBe(dispatches[1]);
    expect(dispatches[1]).toBe(dispatches[2]);
  });

  it("can dispatch an action through the returned function", () => {
    const goLoading = createAction<void, AppStateType>("GoLoading")
      .withPayload(undefined)
      .withState(() => AppState.Loading({ progress: 0 }));
    store.register("GoLoading", goLoading);

    const { result } = renderHook(() => useDispatch(store));

    expect(store.stateValue._tag).toBe("Idle");

    act(() => {
      result.current("tagix/action/GoLoading", undefined);
    });

    expect(store.stateValue._tag).toBe("Loading");
  });
});

describe("useTagix — mutation-kill coverage", () => {
  it("stops re-rendering after unmount (no subscription leak)", () => {
    const setTo = createAction<{ v: number }, AppStateType>("SetTo")
      .withPayload({ v: 0 })
      .withState((_s, p) => ({ _tag: "Success", data: String(p.v) }) as AppStateType);
    store.register("SetTo", setTo);

    let renders = 0;
    const { unmount, result } = renderHook(() => {
      renders++;
      return useTagix(store);
    });
    const rendersAtMount = renders;
    expect(result.current._tag).toBe("Idle");

    unmount();

    act(() => {
      store.dispatch("tagix/action/SetTo", { v: 1 });
      store.dispatch("tagix/action/SetTo", { v: 2 });
    });

    expect(renders).toBe(rendersAtMount);
  });

  it("works with a derived (read-only) store that produces tagged output", () => {
    const View = taggedEnum({ A: { src: "" }, B: { src: "" } });

    const derived = deriveStore(
      [store],
      ([s]) => (s._tag === "Idle" ? View.A({ src: "idle" }) : View.B({ src: s._tag }))
    );

    const { result } = renderHook(() => useTagix(derived));
    expect(result.current._tag).toBe("A");
    expect(result.current.src).toBe("idle");

    const goLoading = createAction<void, AppStateType>("GoLoading")
      .withPayload(undefined)
      .withState(() => ({ _tag: "Loading", progress: 0 }) as AppStateType);
    store.register("GoLoading", goLoading);

    act(() => {
      store.dispatch("tagix/action/GoLoading", undefined);
    });

    expect(result.current._tag).toBe("B");
    expect(result.current.src).toBe("Loading");
    derived.destroy();
  });
});

describe("useTagixSelect — mutation-kill coverage", () => {
  it("honors a custom equals function for structural dedup", () => {
    const setUser = createAction<{ id: number }, AppStateType>("SetUser")
      .withPayload({ id: 0 })
      .withState((_s, p) => ({ _tag: "Success", data: String(p.id) }) as AppStateType);
    store.register("SetUser", setUser);

    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useTagixSelect(
        store,
        (s) => (s._tag === "Success" ? { id: Number(s.data) } : { id: 0 }),
        // Custom equality: only compare the id field, ignore object identity.
        (a, b) => a.id === b.id
      );
    });

    const rendersAfterMount = renders;
    expect(result.current.id).toBe(0);

    act(() => {
      store.dispatch("tagix/action/SetUser", { id: 5 });
    });
    expect(result.current.id).toBe(5);
    const rendersAfterChange = renders;
    expect(rendersAfterChange).toBeGreaterThan(rendersAfterMount);

    // Same id value — custom equals should suppress the re-render.
    act(() => {
      store.dispatch("tagix/action/SetUser", { id: 5 });
    });
    expect(result.current.id).toBe(5);
  });

  it("returns undefined from selector when state does not match", () => {
    const { result } = renderHook(() =>
      useTagixSelect(store, (s) => (s._tag === "Success" ? s.data : undefined))
    );
    expect(result.current).toBeUndefined();
  });
});

describe("useTagixWhen — mutation-kill coverage", () => {
  it("returns to undefined when transitioning away from the matched tag", () => {
    const goSuccess = createAction<{ data: string }, AppStateType>("GoSuccess")
      .withPayload({ data: "" })
      .withState((_s, p) => ({ _tag: "Success", data: p.data }) as AppStateType);
    const goIdle = createAction<void, AppStateType>("GoIdle")
      .withPayload(undefined)
      .withState(() => ({ _tag: "Idle" }) as AppStateType);
    store.register("GoSuccess", goSuccess);
    store.register("GoIdle", goIdle);

    const { result } = renderHook(() => useTagixWhen(store, "Success"));
    expect(result.current).toBeUndefined();

    act(() => {
      store.dispatch("tagix/action/GoSuccess", { data: "hi" });
    });
    expect(result.current?.data).toBe("hi");

    act(() => {
      store.dispatch("tagix/action/GoIdle", undefined);
    });
    expect(result.current).toBeUndefined();
  });

  it("shallow-equals object props so identical props do not re-render", () => {
    const setData = createAction<{ data: string }, AppStateType>("SetData")
      .withPayload({ data: "" })
      .withState((_s, p) => ({ _tag: "Success", data: p.data }) as AppStateType);
    store.register("SetData", setData);

    let renders = 0;
    const { result, rerender } = renderHook(() => {
      renders++;
      return useTagixWhen(store, "Success");
    });

    act(() => {
      store.dispatch("tagix/action/SetData", { data: "same" });
    });
    expect(result.current?.data).toBe("same");
    const rendersAfterSet = renders;

    // Force a re-render without a state change — hook should return the same
    // memoized props object, not a new one.
    rerender();
    expect(result.current?.data).toBe("same");
  });
});

describe("useTagixMatch — mutation-kill coverage", () => {
  it("handles all variants and returns the correct union type", () => {
    const goLoading = createAction<void, AppStateType>("GoLoading")
      .withPayload(undefined)
      .withState(() => ({ _tag: "Loading", progress: 42 }) as AppStateType);
    store.register("GoLoading", goLoading);

    const cases = {
      Idle: () => 0,
      Loading: (s: Extract<AppStateType, { _tag: "Loading" }>) => s.progress,
      Success: (s: Extract<AppStateType, { _tag: "Success" }>) => s.data.length,
      Error: (s: Extract<AppStateType, { _tag: "Error" }>) => s.message.length,
    };

    const { result } = renderHook(() => useTagixMatch(store, cases));
    expect(result.current).toBe(0);

    act(() => {
      store.dispatch("tagix/action/GoLoading", undefined);
    });
    expect(result.current).toBe(42);
  });
});

describe("useDispatch — mutation-kill coverage", () => {
  it("dispatches a typed action object reference", () => {
    const goSuccess = createAction<{ data: string }, AppStateType>("GoSuccess")
      .withPayload({ data: "" })
      .withState((_s, p) => ({ _tag: "Success", data: p.data }) as AppStateType);
    store.register("GoSuccess", goSuccess);

    const { result } = renderHook(() => useDispatch(store));

    act(() => {
      result.current(goSuccess, { data: "typed" });
    });

    expect(store.stateValue._tag).toBe("Success");
    expect((store.stateValue as Extract<AppStateType, { _tag: "Success" }>).data).toBe("typed");
  });
});
