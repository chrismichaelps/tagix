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

import type { Action, AsyncAction } from "../types";
import { ACTION_TYPE_PREFIX } from "../constants";

type ActionRecord = Record<string, Action<any, any> | AsyncAction<any, any, any>>;

type ActionGroupRecord<T extends ActionRecord> = {
  [K in keyof T]: T[K];
};

const getActionType = (action: Action<any, any> | AsyncAction<any, any, any>): string =>
  action.type;

const cloneWithType = <T extends Action<any, any> | AsyncAction<any, any, any>>(
  action: T,
  newType: string
): T => ({ ...action, type: newType }) as T;

/**
 * Creates an action group with a namespace prefix for all actions.
 * @typeParam T - The action record type containing actions to group.
 * @param namespace - The namespace prefix for all actions (e.g., "User", "Cart/Checkout").
 * @param actions - An object containing actions to namespace.
 * @returns A new action group with prefixed action types.
 * @remarks
 * Each action's type is prefixed with `tagix/action/{namespace}/` to avoid naming collisions.
 * Original actions are not mutated - new cloned actions are returned.
 *
 * - Trailing slashes are handled automatically (`"User/"` → `"User/Login"`)
 * - Actions can be dispatched using the group: `store.dispatch(UserActions.login, payload)`
 * - Or by string: `store.dispatch("User/Login", payload)`
 *
 * @example
 * ```ts
 * const login = createAction("Login").withState((_, { username }) =>
 *   UserState.LoggedIn({ name: username, email: "" })
 * );
 *
 * const UserActions = createActionGroup("User", { login });
 * // UserActions.login.type === "tagix/action/User/Login"
 * ```
 */
export function createActionGroup<T extends ActionRecord>(
  namespace: string,
  actions: T
): ActionGroupRecord<T> {
  const suffix = namespace.endsWith("/") ? namespace : `${namespace}/`;
  const result: ActionRecord = {};

  for (const [key, action] of Object.entries(actions)) {
    const originalType = getActionType(action);
    const baseType = originalType.replace(ACTION_TYPE_PREFIX, "");
    const newType = `${ACTION_TYPE_PREFIX}${suffix}${baseType}`;
    result[key] = cloneWithType(action, newType);
  }

  return result as ActionGroupRecord<T>;
}
