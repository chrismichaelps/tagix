import { describe, it, expect, expectTypeOf } from "vitest";
import { lens, prop, pipe, type Lens } from "../index";

interface User {
  readonly name: string;
  readonly age: number;
}

interface State {
  readonly user: User;
  readonly count: number;
}

const state: State = { user: { name: "Chris", age: 30 }, count: 0 };

describe("lens()", () => {
  it("identity lens returns the whole structure", () => {
    const root = lens<State>();
    expect(root.get(state)).toBe(state);
    expect(root.set(state, { user: { name: "Ada", age: 1 }, count: 5 })).toEqual({
      user: { name: "Ada", age: 1 },
      count: 5,
    });
  });

  it("at() focuses a top-level property", () => {
    const countLens = lens<State>().at("count");
    expect(countLens.get(state)).toBe(0);

    const next = countLens.set(state, 10);
    expect(next.count).toBe(10);
    expect(next).not.toBe(state);
    expect(state.count).toBe(0); // original untouched
  });

  it("at() composes for deeply nested properties", () => {
    const nameLens = lens<State>().at("user").at("name");
    expect(nameLens.get(state)).toBe("Chris");

    const next = nameLens.set(state, "Ada");
    expect(next.user.name).toBe("Ada");
    expect(next.user.age).toBe(30); // siblings preserved
    expect(next).not.toBe(state);
    expect(next.user).not.toBe(state.user);
  });

  it("modify() transforms the focused value immutably", () => {
    const ageLens = lens<State>().at("user").at("age");
    const next = ageLens.modify(state, (n) => n + 1);
    expect(next.user.age).toBe(31);
    expect(state.user.age).toBe(30);
  });

  it("set() is dual: data-last form returns a reusable updater", () => {
    const nameLens = lens<State>().at("user").at("name");
    const setName = nameLens.set("Grace");
    expectTypeOf(setName).toEqualTypeOf<(s: State) => State>();

    const next = pipe(state, setName);
    expect(next.user.name).toBe("Grace");
  });

  it("modify() is dual: data-last form composes with pipe", () => {
    const countLens = lens<State>().at("count");
    const next = pipe(
      state,
      countLens.modify((n) => n + 1),
      countLens.modify((n) => n * 10)
    );
    expect(next.count).toBe(10);
  });

  it("compose() joins two lenses", () => {
    const userLens: Lens<State, User> = lens<State>().at("user");
    const nameOfUser: Lens<User, string> = lens<User>().at("name");
    const composed = userLens.compose(nameOfUser);

    expect(composed.get(state)).toBe("Chris");
    expect(composed.set(state, "Linus").user.name).toBe("Linus");
  });

  it("get() preserves the focused type", () => {
    const ageLens = lens<State>().at("user").at("age");
    expectTypeOf(ageLens.get(state)).toEqualTypeOf<number>();
  });
});

describe("prop()", () => {
  it("focuses a single top-level property", () => {
    const countLens = prop<State, "count">("count");
    expect(countLens.get(state)).toBe(0);
    expect(countLens.modify(state, (n) => n + 5).count).toBe(5);
  });
});
