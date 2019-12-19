/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {Dispatcher} from 'react-reconciler/src/ReactFiberHooks';

/**
 *跟踪当前的调度员。
 */
const ReactCurrentDispatcher = {
  /**
   * @internal
   * @type {ReactComponent}
   */ 
  current: null, // Dispatcher | null
};

export default ReactCurrentDispatcher;
