/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/* eslint valid-typeof: 0 */

import invariant from "shared/invariant"
import warningWithoutStack from "shared/warningWithoutStack"

const EVENT_POOL_SIZE = 10

/**
 * @interface Event
 * @see http://www.w3.org/TR/DOM-Level-3-Events/
 */
const EventInterface = {
  type: null,
  target: null,
  currentTarget: function() {
    return null
  },
  eventPhase: null,
  bubbles: null,
  cancelable: null,
  timeStamp: function(event) {
    return event.timeStamp || Date.now()
  },
  defaultPrevented: null,
  isTrusted: null
}

function functionThatReturnsTrue() {
  return true
}

function functionThatReturnsFalse() {
  return false
}

function SyntheticEvent(
  dispatchConfig,
  targetInst,
  nativeEvent,
  nativeEventTarget
) {
  this.dispatchConfig = dispatchConfig
  this._targetInst = targetInst
  this.nativeEvent = nativeEvent

  const Interface = this.constructor.Interface
  for (const propName in Interface) {
    if (!Interface.hasOwnProperty(propName)) {
      continue
    }
    const normalize = Interface[propName]
    if (normalize) {
      this[propName] = normalize(nativeEvent)
    } else {
      if (propName === "target") {
        this.target = nativeEventTarget
      } else {
        this[propName] = nativeEvent[propName]
      }
    }
  }

  const defaultPrevented =
    nativeEvent.defaultPrevented != null
      ? nativeEvent.defaultPrevented
      : nativeEvent.returnValue === false
  if (defaultPrevented) {
    this.isDefaultPrevented = functionThatReturnsTrue
  } else {
    this.isDefaultPrevented = functionThatReturnsFalse
  }
  this.isPropagationStopped = functionThatReturnsFalse
  return this
}

Object.assign(SyntheticEvent.prototype, {
  preventDefault: function() {
    this.defaultPrevented = true
    const event = this.nativeEvent
    if (!event) {
      return
    }

    if (event.preventDefault) {
      event.preventDefault()
    } else if (typeof event.returnValue !== "unknown") {
      event.returnValue = false
    }
    this.isDefaultPrevented = functionThatReturnsTrue
  },

  stopPropagation: function() {
    const event = this.nativeEvent
    if (!event) {
      return
    }

    if (event.stopPropagation) {
      event.stopPropagation()
    } else if (typeof event.cancelBubble !== "unknown") {
      event.cancelBubble = true
    }

    this.isPropagationStopped = functionThatReturnsTrue
  },

  persist: function() {
    this.isPersistent = functionThatReturnsTrue
  },

  isPersistent: functionThatReturnsFalse,

  destructor: function() {
    const Interface = this.constructor.Interface
    for (const propName in Interface) {
      this[propName] = null
    }
    this.dispatchConfig = null
    this._targetInst = null
    this.nativeEvent = null
    this.isDefaultPrevented = functionThatReturnsFalse
    this.isPropagationStopped = functionThatReturnsFalse
    this._dispatchListeners = null
    this._dispatchInstances = null
  }
})

SyntheticEvent.Interface = EventInterface

SyntheticEvent.extend = function(Interface) {
  const Super = this

  // Object.create操作，等于Object.create(Super.prototype)
  const E = function() {}
  E.prototype = Super.prototype
  const prototype = new E()

  function Class() {
    return Super.apply(this, arguments)
  }
  Object.assign(prototype, Class.prototype)
  Class.prototype = prototype
  Class.prototype.constructor = Class

  Class.Interface = Object.assign({}, Super.Interface, Interface)
  Class.extend = Super.extend
  addEventPoolingTo(Class)

  return Class
}

addEventPoolingTo(SyntheticEvent)

function getPooledWarningPropertyDefinition(propName, getVal) {
  const isFunction = typeof getVal === "function"
  return {
    configurable: true,
    set: set,
    get: get
  }

  function set(val) {
    const action = isFunction ? "setting the method" : "setting the property"
    warn(action, "This is effectively a no-op")
    return val
  }

  function get() {
    const action = isFunction
      ? "accessing the method"
      : "accessing the property"
    const result = isFunction
      ? "This is a no-op function"
      : "This is set to null"
    warn(action, result)
    return getVal
  }

  function warn(action, result) {
    const warningCondition = false
    warningWithoutStack(
      warningCondition,
      "This synthetic event is reused for performance reasons. If you're seeing this, " +
        "you're %s `%s` on a released/nullified synthetic event. %s. " +
        "If you must keep the original synthetic event around, use event.persist(). " +
        "See https://fb.me/react-event-pooling for more information.",
      action,
      propName,
      result
    )
  }
}

function getPooledEvent(dispatchConfig, targetInst, nativeEvent, nativeInst) {
  const EventConstructor = this
  if (EventConstructor.eventPool.length) {
    const instance = EventConstructor.eventPool.pop()
    EventConstructor.call(
      instance,
      dispatchConfig,
      targetInst,
      nativeEvent,
      nativeInst
    )
    return instance
  }
  return new EventConstructor(
    dispatchConfig,
    targetInst,
    nativeEvent,
    nativeInst
  )
}

function releasePooledEvent(event) {
  const EventConstructor = this
  event.destructor()
  if (EventConstructor.eventPool.length < EVENT_POOL_SIZE) {
    EventConstructor.eventPool.push(event)
  }
}

function addEventPoolingTo(EventConstructor) {
  EventConstructor.eventPool = []
  EventConstructor.getPooled = getPooledEvent
  EventConstructor.release = releasePooledEvent
}

export default SyntheticEvent
