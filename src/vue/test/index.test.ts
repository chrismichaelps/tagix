import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick } from "vue";
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
  it("returns the current state reactively", async () => {
    const goSuccess = createAction<{ data: string }, AppStateType>("GoSuccess")
      .withPayload({ data: "" })
      .withState((_s, p) => AppState.Success({ data: p.data }));
    store.register("GoSuccess", goSuccess);

    const wrapper = mount(
      defineComponent({
        setup() {
          const state = useTagix(store);
          return () => h("span", { "data-testid": "tag" }, state.value._tag);
        },
      })
    );

    expect(wrapper.find("span").text()).toBe("Idle");

    await store.dispatch("tagix/action/GoSuccess", { data: "hello" });
    await nextTick();

    expect(wrapper.find("span").text()).toBe("Success");
  });
});

describe("useTagixSelect", () => {
  it("reactively returns a derived value", async () => {
    const setProgress = createAction<{ pct: number }, AppStateType>("SetProgress")
      .withPayload({ pct: 0 })
      .withState((_s, p) => AppState.Loading({ progress: p.pct }));
    store.register("SetProgress", setProgress);

    const wrapper = mount(
      defineComponent({
        setup() {
          const pct = useTagixSelect(
            store,
            (s) => (s._tag === "Loading" ? s.progress : 0)
          );
          return () => h("span", { "data-testid": "pct" }, String(pct.value));
        },
      })
    );

    expect(wrapper.find("span").text()).toBe("0");

    await store.dispatch("tagix/action/SetProgress", { pct: 75 });
    await nextTick();

    expect(wrapper.find("span").text()).toBe("75");
  });
});

describe("useTagixWhen", () => {
  it("returns variant props when matched, undefined otherwise", async () => {
    const goSuccess = createAction<{ data: string }, AppStateType>("GoSuccess")
      .withPayload({ data: "" })
      .withState((_s, p) => AppState.Success({ data: p.data }));
    store.register("GoSuccess", goSuccess);

    const wrapper = mount(
      defineComponent({
        setup() {
          const success = useTagixWhen(store, "Success");
          return () =>
            success.value
              ? h("span", { "data-testid": "result" }, success.value.data)
              : h("span", { "data-testid": "result" }, "none");
        },
      })
    );

    expect(wrapper.find("span").text()).toBe("none");

    await store.dispatch("tagix/action/GoSuccess", { data: "payload!" });
    await nextTick();

    expect(wrapper.find("span").text()).toBe("payload!");
  });

  it("returns undefined after transitioning away from the matched tag", async () => {
    const goSuccess = createAction<{ data: string }, AppStateType>("GoSuccess")
      .withPayload({ data: "" })
      .withState((_s, p) => AppState.Success({ data: p.data }));
    const goIdle = createAction<void, AppStateType>("GoIdle")
      .withPayload(undefined)
      .withState(() => AppState.Idle({}));
    store.register("GoSuccess", goSuccess);
    store.register("GoIdle", goIdle);

    const wrapper = mount(
      defineComponent({
        setup() {
          const success = useTagixWhen(store, "Success");
          return () =>
            h("span", { "data-testid": "val" }, success.value ? "matched" : "unmatched");
        },
      })
    );

    await store.dispatch("tagix/action/GoSuccess", { data: "x" });
    await nextTick();
    expect(wrapper.find("span").text()).toBe("matched");

    await store.dispatch("tagix/action/GoIdle", undefined);
    await nextTick();
    expect(wrapper.find("span").text()).toBe("unmatched");
  });
});

describe("useTagixMatch", () => {
  it("exhaustively matches and returns reactive result", async () => {
    const goError = createAction<{ message: string }, AppStateType>("GoError")
      .withPayload({ message: "" })
      .withState((_s, p) => AppState.Error({ message: p.message }));
    store.register("GoError", goError);

    const wrapper = mount(
      defineComponent({
        setup() {
          const label = useTagixMatch(store, {
            Idle: () => "idle",
            Loading: (s) => `loading:${s.progress}`,
            Success: (s) => s.data,
            Error: (s) => `err:${s.message}`,
          });
          return () => h("span", { "data-testid": "label" }, label.value);
        },
      })
    );

    expect(wrapper.find("span").text()).toBe("idle");

    await store.dispatch("tagix/action/GoError", { message: "boom" });
    await nextTick();

    expect(wrapper.find("span").text()).toBe("err:boom");
  });
});

describe("useDispatch", () => {
  it("dispatches actions through a stable function", async () => {
    const goLoading = createAction<void, AppStateType>("GoLoading")
      .withPayload(undefined)
      .withState(() => AppState.Loading({ progress: 0 }));
    store.register("GoLoading", goLoading);

    const wrapper = mount(
      defineComponent({
        setup() {
          const state = useTagix(store);
          const dispatch = useDispatch(store);
          const fire = () => dispatch("tagix/action/GoLoading", undefined);
          return () => h("button", { onClick: fire }, state.value._tag);
        },
      })
    );

    expect(wrapper.find("button").text()).toBe("Idle");

    await wrapper.find("button").trigger("click");
    await nextTick();

    expect(wrapper.find("button").text()).toBe("Loading");
  });

  it("dispatches a typed action object reference", async () => {
    const goLoading = createAction<void, AppStateType>("GoLoading")
      .withPayload(undefined)
      .withState(() => AppState.Loading({ progress: 0 }));
    store.register("GoLoading", goLoading);

    const wrapper = mount(
      defineComponent({
        setup() {
          const state = useTagix(store);
          const dispatch = useDispatch(store);
          const fire = () => dispatch(goLoading, undefined);
          return () => h("button", { onClick: fire }, state.value._tag);
        },
      })
    );

    await wrapper.find("button").trigger("click");
    await nextTick();

    expect(wrapper.find("button").text()).toBe("Loading");
  });
});

describe("useTagix — mutation-kill coverage", () => {
  it("works with a derived (read-only) store", async () => {
    const View = taggedEnum({ A: { src: "" }, B: { src: "" } });
    const derived = deriveStore(
      [store],
      ([s]) => (s._tag === "Idle" ? View.A({ src: "idle" }) : View.B({ src: s._tag }))
    );

    const goLoading = createAction<void, AppStateType>("GoLoading")
      .withPayload(undefined)
      .withState(() => AppState.Loading({ progress: 0 }));
    store.register("GoLoading", goLoading);

    const wrapper = mount(
      defineComponent({
        setup() {
          const state = useTagix(derived);
          return () => h("span", state.value.src);
        },
      })
    );

    expect(wrapper.find("span").text()).toBe("idle");

    await store.dispatch("tagix/action/GoLoading", undefined);
    await nextTick();

    expect(wrapper.find("span").text()).toBe("Loading");
    derived.destroy();
  });

  it("unsubscribes from the store when the component unmounts (no leak)", async () => {
    const unsubscribe = vi.fn();
    const subscribeSpy = vi.spyOn(store, "subscribe").mockReturnValue(unsubscribe);

    const wrapper = mount(
      defineComponent({
        setup() {
          const state = useTagix(store);
          return () => h("span", state.value._tag);
        },
      })
    );

    expect(subscribeSpy).toHaveBeenCalledOnce();
    expect(unsubscribe).not.toHaveBeenCalled();

    wrapper.unmount();

    expect(unsubscribe).toHaveBeenCalledOnce();

    subscribeSpy.mockRestore();
  });
});
