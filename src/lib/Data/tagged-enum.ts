// https://gist.github.com/chrismichaelps/c0a8b3ea083ad2e01357f4f2990bba9a

import { isTagged, isRecord } from "./predicate";
import type { Refinement } from "./predicate";

export type TaggedEnum<A extends Record<string, Record<string, unknown>>> = {
  [Tag in keyof A & string]: { readonly _tag: Tag } & {
    readonly [K in keyof A[Tag]]: A[Tag][K];
  };
}[keyof A & string];

export type MatchCases<A extends { readonly _tag: string }, R> = {
  [K in A["_tag"]]: (args: Extract<A, { _tag: K }>) => R;
};

export type TaggedEnumConstructor<A extends { readonly _tag: string }> = {
  [K in A["_tag"]]: (args: Omit<Extract<A, { _tag: K }>, "_tag">) => Extract<A, { _tag: K }>;
} & {
  readonly $is: <Tag extends A["_tag"]>(tag: Tag) => Refinement<unknown, Extract<A, { _tag: Tag }>>;
  readonly $match: {
    <R>(cases: MatchCases<A, R>): (value: A) => R;
    <R>(value: A, cases: MatchCases<A, R>): R;
  };
  readonly State: A;
};

export type GetState<T> = T extends TaggedEnumConstructor<infer A> ? A : never;

function createTagConstructor<A extends { readonly _tag: string }>(
  tag: string
): (args: Record<string, unknown>) => A {
  return (args) => {
    const result = isRecord(args) ? { _tag: tag, ...args } : { _tag: tag };
    return result as A;
  };
}

function createIsRefinement<A extends { readonly _tag: string }>(
  tag: string
): Refinement<unknown, A> {
  const baseRefinement = isTagged(tag);
  return (value: unknown): value is A => baseRefinement(value);
}

export function taggedEnum<A extends Record<string, Record<string, unknown>>>(
  definition: A
): TaggedEnumConstructor<TaggedEnum<A>> & { State: TaggedEnum<A> } {
  const cache = new Map<string | symbol, unknown>();

  return new Proxy({} as TaggedEnumConstructor<TaggedEnum<A>> & { State: TaggedEnum<A> }, {
    get(_target, prop) {
      if (cache.has(prop)) {
        return cache.get(prop);
      }

      if (prop === "$is") {
        const fn = <Tag extends TaggedEnum<A>["_tag"]>(
          tag: Tag
        ): Refinement<unknown, Extract<TaggedEnum<A>, { _tag: Tag }>> =>
          createIsRefinement<Extract<TaggedEnum<A>, { _tag: Tag }>>(tag);
        cache.set(prop, fn);
        return fn;
      }

      if (prop === "$match") {
        const fn = <R>(
          valueOrCases: TaggedEnum<A> | MatchCases<TaggedEnum<A>, R>,
          maybeCases?: MatchCases<TaggedEnum<A>, R>
        ): R | ((value: TaggedEnum<A>) => R) => {
          if (maybeCases === undefined) {
            const cases = valueOrCases as MatchCases<TaggedEnum<A>, R>;
            return (value: TaggedEnum<A>): R => {
              const handler = cases[value._tag as TaggedEnum<A>["_tag"]];
              return handler(value as Parameters<typeof handler>[0]);
            };
          }
          const value = valueOrCases as TaggedEnum<A>;
          const handler = maybeCases[value._tag as TaggedEnum<A>["_tag"]];
          return handler(value as Parameters<typeof handler>[0]);
        };
        cache.set(prop, fn);
        return fn;
      }

      if (prop === "State") {
        const stateObj = Object.freeze(
          Object.fromEntries(
            Object.entries(definition).map(([tag, schema]) => [tag, Object.freeze({ ...schema })])
          )
        );
        cache.set(prop, stateObj);
        return stateObj;
      }

      if (typeof prop === "string") {
        const constructor = createTagConstructor<TaggedEnum<A>>(prop);
        cache.set(prop, constructor);
        return constructor;
      }

      return undefined;
    },
  });
}
