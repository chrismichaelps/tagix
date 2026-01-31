export {
  type TaggedEnum,
  type TaggedEnumConstructor,
  type MatchCases,
  taggedEnum,
} from "./tagged-enum";

export {
  type Left,
  type Right,
  type Either,
  left,
  right,
  isEither,
  isLeft,
  isRight,
  fromNullable as fromNullableEither,
  tryCatch,
  tryCatchAsync,
  match as matchEither,
  map as mapEither,
  mapLeft,
  flatMap as flatMapEither,
  getOrElse as getOrElseEither,
  getOrThrow,
  type Result,
  ok,
  fail,
  toResult,
  toResultAsync,
  resultFromNullable,
  resultGetOrThrow,
  resultGetOrElse,
  resultMap,
  resultMapError,
  resultFlatMap,
} from "./either";

export {
  type None,
  type Some,
  type Option,
  none,
  some,
  isOption,
  isNone,
  isSome,
  fromNullable as fromNullableOption,
  getOrNull,
  getOrUndefined,
  getOrElse as getOrElseOption,
  orElse,
  match as matchOption,
  map as mapOption,
  flatMap as flatMapOption,
  filter,
  tap,
} from "./option";

export * from "./functions";
export * from "./predicate";

export { type TaggedError as TaggedErrorType, TaggedError, isTaggedError } from "./tagged-error";
