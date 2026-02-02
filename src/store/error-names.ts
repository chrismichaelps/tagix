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

/**
 * Error name constants for Tagix error types.
 * @remarks Used internally for error identification and categorization.
 */
export const ERROR_NAMES = {
  STATE_TRANSITION: "StateTransitionError",
  MISSING_HANDLER: "MissingHandlerError",
  ACTION_NOT_FOUND: "ActionNotFoundError",
  INVALID_PAYLOAD: "InvalidPayloadError",
  NON_EXHAUSTIVE_MATCH: "NonExhaustiveMatchError",
  REQUIRED_PAYLOAD: "RequiredPayloadError",
  PAYLOAD_VALIDATION: "PayloadValidationError",
  UNEXPECTED_STATE: "UnexpectedStateError",
} as const;

/**
 * Union type of all error names.
 */
export type ErrorName = (typeof ERROR_NAMES)[keyof typeof ERROR_NAMES];

/**
 * Numeric error codes for each error type.
 * @remarks Used for error categorization and analytics.
 */
export const ERROR_CODES = {
  STATE_TRANSITION: 1001,
  MISSING_HANDLER: 1002,
  ACTION_NOT_FOUND: 1004,
  INVALID_PAYLOAD: 1005,
  NON_EXHAUSTIVE_MATCH: 1007,
  REQUIRED_PAYLOAD: 1008,
  PAYLOAD_VALIDATION: 1009,
  UNEXPECTED_STATE: 1010,
} as const;
/**
 * Union type of all error codes.
 */
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * Maps an error name to its corresponding error code.
 * @param name - The error name to look up.
 * @returns The numeric error code.
 */
export const getErrorCode = (name: ErrorName): ErrorCode => {
  const codes = ERROR_CODES as unknown as Record<ErrorName, ErrorCode>;
  return codes[name];
};

/**
 * Structured error object with tag, code, and message.
 * @remarks All Tagix errors conform to this shape for consistent error handling.
 */
export interface TagixErrorObject {
  readonly _tag: string;
  readonly code: number;
  readonly message: string;
}

/**
 * Type guard to check if an error is a Tagix error.
 * @param error - The value to check.
 * @returns True if the error has the Tagix error structure.
 */
export const isTagixError = (error: unknown): error is TagixErrorObject => {
  if (error === null || typeof error !== "object") return false;

  const e = error as TagixErrorObject;

  const hasTag = "_tag" in e && typeof e._tag === "string";
  const hasCode = "code" in e && typeof e.code === "number";

  return hasTag && hasCode;
};

/**
 * Extracts structured error information from an unknown error.
 * @param error - The error to extract information from.
 * @returns TagixErrorObject if the error is a Tagix error, null otherwise.
 */
export const getErrorInfo = (error: unknown): TagixErrorObject | null => {
  if (!isTagixError(error)) return null;

  const e = error as TagixErrorObject;
  return {
    _tag: e._tag,
    code: e.code,
    message: error instanceof Error ? error.message : "Unknown error",
  };
};

/**
 * Error categories grouping related error codes.
 * @remarks Used for error analytics and recovery strategies.
 */
export const ERROR_CATEGORIES = {
  STATE: [ERROR_CODES.STATE_TRANSITION, ERROR_CODES.UNEXPECTED_STATE] as const,
  ACTION: [ERROR_CODES.ACTION_NOT_FOUND, ERROR_CODES.MISSING_HANDLER] as const,
  PAYLOAD: [
    ERROR_CODES.INVALID_PAYLOAD,
    ERROR_CODES.REQUIRED_PAYLOAD,
    ERROR_CODES.PAYLOAD_VALIDATION,
  ] as const,
  MATCH: [ERROR_CODES.NON_EXHAUSTIVE_MATCH] as const,
} as const;

/**
 * Union type of all error category names.
 */
export type ErrorCategory = keyof typeof ERROR_CATEGORIES;

const codeToCategoryMap: Map<number, ErrorCategory> = new Map([
  ...ERROR_CATEGORIES.STATE.map((c) => [c, "STATE"] as [number, ErrorCategory]),
  ...ERROR_CATEGORIES.ACTION.map((c) => [c, "ACTION"] as [number, ErrorCategory]),
  ...ERROR_CATEGORIES.PAYLOAD.map((c) => [c, "PAYLOAD"] as [number, ErrorCategory]),
  ...ERROR_CATEGORIES.MATCH.map((c) => [c, "MATCH"] as [number, ErrorCategory]),
]);

const recoverableCategoriesSet: ReadonlySet<ErrorCategory> = new Set([
  "STATE",
  "ACTION",
  "PAYLOAD",
]);

/**
 * Gets the category for a given error code.
 * @param code - The error code to look up.
 * @returns The error category, or undefined if not found.
 */
export const getErrorCategory = (code: number): ErrorCategory | undefined => {
  return codeToCategoryMap.get(code);
};

/**
 * Checks if an error code represents a recoverable error.
 * @param code - The error code to check.
 * @returns True if the error is recoverable (STATE, ACTION, or PAYLOAD category).
 */
export const isRecoverableError = (code: number): boolean => {
  const category = codeToCategoryMap.get(code);
  return category !== undefined && recoverableCategoriesSet.has(category);
};

/**
 * Creates an error payload with the corresponding error code.
 * @typeParam T - The payload object type.
 * @param name - The error name.
 * @param payload - The error payload data.
 * @returns The payload with the error code added.
 */
export const createErrorPayload = <T extends object>(
  name: ErrorName,
  payload: T
): T & { code: number } => {
  return {
    ...payload,
    code: getErrorCode(name),
  };
};
