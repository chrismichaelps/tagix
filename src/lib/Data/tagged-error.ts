// https://gist.github.com/chrismichaelps/c0a8b3ea083ad2e01357f4f2990bba9a

import { isRecord, isString, isNotNullish } from "./predicate";

const plainArgsSymbol = Symbol.for("plainArgs");

type ErrorArgs = Record<string, unknown>;

export interface TaggedError<Tag extends string> extends Error {
  readonly _tag: Tag;
}

function extractMessage(args: ErrorArgs): string | undefined {
  const msg = args?.message;
  return isString(msg) ? msg : undefined;
}

function extractCause(args: ErrorArgs): { cause: unknown } | undefined {
  return isNotNullish(args?.cause) ? { cause: args.cause } : undefined;
}

function getStoredArgs(instance: object): ErrorArgs {
  const stored = (instance as Record<string | symbol, unknown>)[plainArgsSymbol];
  return isRecord(stored) ? stored : {};
}

class TaggedErrorBase<Tag extends string> extends Error {
  readonly _tag: Tag;

  constructor(tag: Tag, args: ErrorArgs) {
    super(extractMessage(args), extractCause(args));
    this._tag = tag;
    this.name = tag;
    Object.assign(this, args);
    Object.defineProperty(this, plainArgsSymbol, {
      value: args,
      enumerable: false,
    });
  }

  toJSON(): Record<string, unknown> {
    return {
      _tag: this._tag,
      name: this.name,
      message: this.message,
      ...getStoredArgs(this),
    };
  }
}

export function TaggedError<Tag extends string>(
  tag: Tag
): new <A extends ErrorArgs = Record<string, never>>(args: A) => TaggedError<Tag> & Readonly<A> {
  return class extends TaggedErrorBase<Tag> {
    constructor(args: ErrorArgs) {
      super(tag, args);
    }
  } as new <A extends ErrorArgs = Record<string, never>>(args: A) => TaggedError<Tag> & Readonly<A>;
}

export const isTaggedError = (u: unknown): u is { readonly _tag: string } & Error =>
  isRecord(u) && "_tag" in u && isString(u._tag) && u instanceof Error;
