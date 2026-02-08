/*
MIT License

Copyright (c) 2026 Chris M. (Michael) Pérez

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all
  copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.
 */

import { TaggedError } from "../lib/Data/tagged-error";
import { ERROR_NAMES } from "./error-names";

/**
 * Thrown when a state transition produces an unexpected state tag in strict mode.
 * @remarks Only thrown when `strict: true` is set in store configuration.
 */
export const StateTransitionError = TaggedError(ERROR_NAMES.STATE_TRANSITION);

/**
 * Thrown when an action handler is not registered for a dispatched action.
 */
export const MissingHandlerError = TaggedError(ERROR_NAMES.MISSING_HANDLER);

/**
 * Thrown when dispatching an action type that has not been registered.
 */
export const ActionNotFoundError = TaggedError(ERROR_NAMES.ACTION_NOT_FOUND);

/**
 * Thrown when an action object is malformed or missing required properties.
 * @remarks Catches issues like invalid effect function, missing state/onSuccess/onError handlers.
 */
export const InvalidActionError = TaggedError(ERROR_NAMES.INVALID_ACTION);

/**
 * Thrown when payload validation fails.
 * @remarks Use `validatePayload` guard to trigger this error.
 */
export const InvalidPayloadError = TaggedError(ERROR_NAMES.INVALID_PAYLOAD);

/**
 * Thrown when pattern matching is non-exhaustive.
 * @remarks Use `exhaust` function to ensure all state tags are handled.
 */
export const NonExhaustiveMatchError = TaggedError(ERROR_NAMES.NON_EXHAUSTIVE_MATCH);

/**
 * Thrown when a required payload is missing or null/undefined.
 * @remarks Use `fromPayload` guard to trigger this error.
 */
export const RequiredPayloadError = TaggedError(ERROR_NAMES.REQUIRED_PAYLOAD);

/**
 * Thrown when a payload validation predicate returns false.
 * @remarks Use `validatePayload` guard to trigger this error.
 */
export const PayloadValidationError = TaggedError(ERROR_NAMES.PAYLOAD_VALIDATION);

/**
 * Thrown when state is in an unexpected condition.
 * @remarks Use `ensureState` guard to trigger this error when state tag doesn't match.
 */
export const UnexpectedStateError = TaggedError(ERROR_NAMES.UNEXPECTED_STATE);

export type StateTransitionError = InstanceType<typeof StateTransitionError>;
export type MissingHandlerError = InstanceType<typeof MissingHandlerError>;
export type ActionNotFoundError = InstanceType<typeof ActionNotFoundError>;
export type InvalidActionError = InstanceType<typeof InvalidActionError>;
export type InvalidPayloadError = InstanceType<typeof InvalidPayloadError>;
export type NonExhaustiveMatchError = InstanceType<typeof NonExhaustiveMatchError>;
export type RequiredPayloadError = InstanceType<typeof RequiredPayloadError>;
export type PayloadValidationError = InstanceType<typeof PayloadValidationError>;
export type UnexpectedStateError = InstanceType<typeof UnexpectedStateError>;

/**
 * Union type of all Tagix error instances.
 * @remarks Use this for comprehensive error handling across the library.
 */
export type TagixError =
  | StateTransitionError
  | MissingHandlerError
  | ActionNotFoundError
  | InvalidActionError
  | InvalidPayloadError
  | NonExhaustiveMatchError
  | RequiredPayloadError
  | PayloadValidationError
  | UnexpectedStateError;
