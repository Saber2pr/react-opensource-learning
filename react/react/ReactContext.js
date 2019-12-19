/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import {REACT_PROVIDER_TYPE, REACT_CONTEXT_TYPE} from 'shared/ReactSymbols'

import type {ReactContext} from 'shared/ReactTypes'

import warningWithoutStack from 'shared/warningWithoutStack'
import warning from 'shared/warning'

export function createContext<T>(
  defaultValue: T,
  calculateChangedBits: (a: T, b: T) => number,
): ReactContext<T> {
  if (calculateChangedBits === undefined) {
    calculateChangedBits = null
  }

  const context: ReactContext<T> = {
    $$typeof: REACT_CONTEXT_TYPE,
    _calculateChangedBits: calculateChangedBits,
    _currentValue: defaultValue,
    _currentValue2: defaultValue,
    _threadCount: 0,
    Provider: null,
    Consumer: null,
  }

  context.Provider = {
    $$typeof: REACT_PROVIDER_TYPE,
    _context: context,
  }

  context.Consumer = context

  return context
}
