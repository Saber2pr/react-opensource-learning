// 这个包主要用来匹配React Component上的$$typeof属性

import {
  REACT_ASYNC_MODE_TYPE,
  REACT_CONCURRENT_MODE_TYPE,
  REACT_CONTEXT_TYPE,
  REACT_ELEMENT_TYPE,
  REACT_FORWARD_REF_TYPE,
  REACT_FRAGMENT_TYPE,
  REACT_LAZY_TYPE,
  REACT_MEMO_TYPE,
  REACT_PORTAL_TYPE,
  REACT_PROFILER_TYPE,
  REACT_PROVIDER_TYPE,
  REACT_STRICT_MODE_TYPE,
  REACT_SUSPENSE_TYPE,
} from 'shared/ReactSymbols';
import isValidElementType from 'shared/isValidElementType';
import lowPriorityWarning from 'shared/lowPriorityWarning';

// typeOf: Component => unique Symbol
export function typeOf (object) {
  if (typeof object === 'object' && object !== null) {
    const $$typeof = object.$$typeof;
    switch ($$typeof) {
      case REACT_ELEMENT_TYPE:
        const type = object.type;

        switch (type) {
          case REACT_ASYNC_MODE_TYPE:
          case REACT_CONCURRENT_MODE_TYPE:
          case REACT_FRAGMENT_TYPE:
          case REACT_PROFILER_TYPE:
          case REACT_STRICT_MODE_TYPE:
          case REACT_SUSPENSE_TYPE:
            return type;
          default:
            const $$typeofType = type && type.$$typeof;

            switch ($$typeofType) {
              case REACT_CONTEXT_TYPE:
              case REACT_FORWARD_REF_TYPE:
              case REACT_PROVIDER_TYPE:
                return $$typeofType;
              default:
                return $$typeof;
            }
        }
      case REACT_LAZY_TYPE:
      case REACT_MEMO_TYPE:
      case REACT_PORTAL_TYPE:
        return $$typeof;
    }
  }

  return undefined;
}

// AsyncMode is deprecated along with isAsyncMode
export const AsyncMode = REACT_ASYNC_MODE_TYPE;
export const ConcurrentMode = REACT_CONCURRENT_MODE_TYPE;
export const ContextConsumer = REACT_CONTEXT_TYPE;
export const ContextProvider = REACT_PROVIDER_TYPE;
export const Element = REACT_ELEMENT_TYPE;
export const ForwardRef = REACT_FORWARD_REF_TYPE;
export const Fragment = REACT_FRAGMENT_TYPE;
export const Lazy = REACT_LAZY_TYPE;
export const Memo = REACT_MEMO_TYPE;
export const Portal = REACT_PORTAL_TYPE;
export const Profiler = REACT_PROFILER_TYPE;
export const StrictMode = REACT_STRICT_MODE_TYPE;
export const Suspense = REACT_SUSPENSE_TYPE;

export { isValidElementType };

let hasWarnedAboutDeprecatedIsAsyncMode = false;

// AsyncMode should be deprecated
export function isAsyncMode (object) {
  if (__DEV__) {
    if (!hasWarnedAboutDeprecatedIsAsyncMode) {
      hasWarnedAboutDeprecatedIsAsyncMode = true;
      lowPriorityWarning(
        false,
        'The ReactIs.isAsyncMode() alias has been deprecated, ' +
        'and will be removed in React 17+. Update your code to use ' +
        'ReactIs.isConcurrentMode() instead. It has the exact same API.',
      );
    }
  }
  return isConcurrentMode(object) || typeOf(object) === REACT_ASYNC_MODE_TYPE;
}
export function isConcurrentMode (object) {
  return typeOf(object) === REACT_CONCURRENT_MODE_TYPE;
}
export function isContextConsumer (object) {
  return typeOf(object) === REACT_CONTEXT_TYPE;
}
export function isContextProvider (object) {
  return typeOf(object) === REACT_PROVIDER_TYPE;
}
export function isElement (object) {
  return (
    typeof object === 'object' &&
    object !== null &&
    object.$$typeof === REACT_ELEMENT_TYPE
  );
}
export function isForwardRef (object) {
  return typeOf(object) === REACT_FORWARD_REF_TYPE;
}
export function isFragment (object) {
  return typeOf(object) === REACT_FRAGMENT_TYPE;
}
export function isLazy (object) {
  return typeOf(object) === REACT_LAZY_TYPE;
}
export function isMemo (object) {
  return typeOf(object) === REACT_MEMO_TYPE;
}
export function isPortal (object) {
  return typeOf(object) === REACT_PORTAL_TYPE;
}
export function isProfiler (object) {
  return typeOf(object) === REACT_PROFILER_TYPE;
}
export function isStrictMode (object) {
  return typeOf(object) === REACT_STRICT_MODE_TYPE;
}
export function isSuspense (object) {
  return typeOf(object) === REACT_SUSPENSE_TYPE;
}