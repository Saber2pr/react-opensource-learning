/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { getLowestCommonAncestor, isAncestor } from "shared/ReactTreeTraversal"

import {
  executeDirectDispatch,
  hasDispatches,
  executeDispatchesInOrderStopAtTrue,
  getInstanceFromNode
} from "./EventPluginUtils"
import {
  accumulateDirectDispatches,
  accumulateTwoPhaseDispatches,
  accumulateTwoPhaseDispatchesSkipTarget
} from "./EventPropagators"
import ResponderSyntheticEvent from "./ResponderSyntheticEvent"
import ResponderTouchHistoryStore from "./ResponderTouchHistoryStore"
import accumulate from "./accumulate"
import {
  TOP_SCROLL,
  TOP_SELECTION_CHANGE,
  TOP_TOUCH_CANCEL,
  isStartish,
  isMoveish,
  isEndish,
  startDependencies,
  moveDependencies,
  endDependencies
} from "./ResponderTopLevelEventTypes"

/**
 * Instance of element that should respond to touch/move types of interactions,
 * as indicated explicitly by relevant callbacks.
 */
let responderInst = null

/**
 * Count of current touches. A textInput should become responder iff the
 * selection changes while there is a touch on the screen.
 */
let trackedTouchCount = 0

const changeResponder = function(nextResponderInst, blockHostResponder) {
  const oldResponderInst = responderInst
  responderInst = nextResponderInst
  if (ResponderEventPlugin.GlobalResponderHandler !== null) {
    ResponderEventPlugin.GlobalResponderHandler.onChange(
      oldResponderInst,
      nextResponderInst,
      blockHostResponder
    )
  }
}

const eventTypes = {
  /**
   * On a `touchStart`/`mouseDown`, is it desired that this element become the
   * responder?
   */
  startShouldSetResponder: {
    phasedRegistrationNames: {
      bubbled: "onStartShouldSetResponder",
      captured: "onStartShouldSetResponderCapture"
    },
    dependencies: startDependencies
  },

  /**
   * On a `scroll`, is it desired that this element become the responder? This
   * is usually not needed, but should be used to retroactively infer that a
   * `touchStart` had occurred during momentum scroll. During a momentum scroll,
   * a touch start will be immediately followed by a scroll event if the view is
   * currently scrolling.
   *
   * TODO: This shouldn't bubble.
   */
  scrollShouldSetResponder: {
    phasedRegistrationNames: {
      bubbled: "onScrollShouldSetResponder",
      captured: "onScrollShouldSetResponderCapture"
    },
    dependencies: [TOP_SCROLL]
  },

  /**
   * On text selection change, should this element become the responder? This
   * is needed for text inputs or other views with native selection, so the
   * JS view can claim the responder.
   *
   * TODO: This shouldn't bubble.
   */
  selectionChangeShouldSetResponder: {
    phasedRegistrationNames: {
      bubbled: "onSelectionChangeShouldSetResponder",
      captured: "onSelectionChangeShouldSetResponderCapture"
    },
    dependencies: [TOP_SELECTION_CHANGE]
  },

  /**
   * On a `touchMove`/`mouseMove`, is it desired that this element become the
   * responder?
   */
  moveShouldSetResponder: {
    phasedRegistrationNames: {
      bubbled: "onMoveShouldSetResponder",
      captured: "onMoveShouldSetResponderCapture"
    },
    dependencies: moveDependencies
  },

  /**
   * Direct responder events dispatched directly to responder. Do not bubble.
   */
  responderStart: {
    registrationName: "onResponderStart",
    dependencies: startDependencies
  },
  responderMove: {
    registrationName: "onResponderMove",
    dependencies: moveDependencies
  },
  responderEnd: {
    registrationName: "onResponderEnd",
    dependencies: endDependencies
  },
  responderRelease: {
    registrationName: "onResponderRelease",
    dependencies: endDependencies
  },
  responderTerminationRequest: {
    registrationName: "onResponderTerminationRequest",
    dependencies: []
  },
  responderGrant: {
    registrationName: "onResponderGrant",
    dependencies: []
  },
  responderReject: {
    registrationName: "onResponderReject",
    dependencies: []
  },
  responderTerminate: {
    registrationName: "onResponderTerminate",
    dependencies: []
  }
}

function setResponderAndExtractTransfer(
  topLevelType,
  targetInst,
  nativeEvent,
  nativeEventTarget
) {
  const shouldSetEventType = isStartish(topLevelType)
    ? eventTypes.startShouldSetResponder
    : isMoveish(topLevelType)
    ? eventTypes.moveShouldSetResponder
    : topLevelType === TOP_SELECTION_CHANGE
    ? eventTypes.selectionChangeShouldSetResponder
    : eventTypes.scrollShouldSetResponder

  // TODO: stop one short of the current responder.
  const bubbleShouldSetFrom = !responderInst
    ? targetInst
    : getLowestCommonAncestor(responderInst, targetInst)

  const skipOverBubbleShouldSetFrom = bubbleShouldSetFrom === responderInst
  const shouldSetEvent = ResponderSyntheticEvent.getPooled(
    shouldSetEventType,
    bubbleShouldSetFrom,
    nativeEvent,
    nativeEventTarget
  )
  shouldSetEvent.touchHistory = ResponderTouchHistoryStore.touchHistory
  if (skipOverBubbleShouldSetFrom) {
    accumulateTwoPhaseDispatchesSkipTarget(shouldSetEvent)
  } else {
    accumulateTwoPhaseDispatches(shouldSetEvent)
  }
  const wantsResponderInst = executeDispatchesInOrderStopAtTrue(shouldSetEvent)
  if (!shouldSetEvent.isPersistent()) {
    shouldSetEvent.constructor.release(shouldSetEvent)
  }

  if (!wantsResponderInst || wantsResponderInst === responderInst) {
    return null
  }
  let extracted
  const grantEvent = ResponderSyntheticEvent.getPooled(
    eventTypes.responderGrant,
    wantsResponderInst,
    nativeEvent,
    nativeEventTarget
  )
  grantEvent.touchHistory = ResponderTouchHistoryStore.touchHistory

  accumulateDirectDispatches(grantEvent)
  const blockHostResponder = executeDirectDispatch(grantEvent) === true
  if (responderInst) {
    const terminationRequestEvent = ResponderSyntheticEvent.getPooled(
      eventTypes.responderTerminationRequest,
      responderInst,
      nativeEvent,
      nativeEventTarget
    )
    terminationRequestEvent.touchHistory =
      ResponderTouchHistoryStore.touchHistory
    accumulateDirectDispatches(terminationRequestEvent)
    const shouldSwitch =
      !hasDispatches(terminationRequestEvent) ||
      executeDirectDispatch(terminationRequestEvent)
    if (!terminationRequestEvent.isPersistent()) {
      terminationRequestEvent.constructor.release(terminationRequestEvent)
    }

    if (shouldSwitch) {
      const terminateEvent = ResponderSyntheticEvent.getPooled(
        eventTypes.responderTerminate,
        responderInst,
        nativeEvent,
        nativeEventTarget
      )
      terminateEvent.touchHistory = ResponderTouchHistoryStore.touchHistory
      accumulateDirectDispatches(terminateEvent)
      extracted = accumulate(extracted, [grantEvent, terminateEvent])
      changeResponder(wantsResponderInst, blockHostResponder)
    } else {
      const rejectEvent = ResponderSyntheticEvent.getPooled(
        eventTypes.responderReject,
        wantsResponderInst,
        nativeEvent,
        nativeEventTarget
      )
      rejectEvent.touchHistory = ResponderTouchHistoryStore.touchHistory
      accumulateDirectDispatches(rejectEvent)
      extracted = accumulate(extracted, rejectEvent)
    }
  } else {
    extracted = accumulate(extracted, grantEvent)
    changeResponder(wantsResponderInst, blockHostResponder)
  }
  return extracted
}

function canTriggerTransfer(topLevelType, topLevelInst, nativeEvent) {
  return (
    topLevelInst &&
    ((topLevelType === TOP_SCROLL && !nativeEvent.responderIgnoreScroll) ||
      (trackedTouchCount > 0 && topLevelType === TOP_SELECTION_CHANGE) ||
      isStartish(topLevelType) ||
      isMoveish(topLevelType))
  )
}

function noResponderTouches(nativeEvent) {
  const touches = nativeEvent.touches
  if (!touches || touches.length === 0) {
    return true
  }
  for (let i = 0; i < touches.length; i++) {
    const activeTouch = touches[i]
    const target = activeTouch.target
    if (target !== null && target !== undefined && target !== 0) {
      // Is the original touch location inside of the current responder?
      const targetInst = getInstanceFromNode(target)
      if (isAncestor(responderInst, targetInst)) {
        return false
      }
    }
  }
  return true
}

const ResponderEventPlugin = {
  /* For unit testing only */
  _getResponder: function() {
    return responderInst
  },

  eventTypes: eventTypes,

  extractEvents: function(
    topLevelType,
    targetInst,
    nativeEvent,
    nativeEventTarget
  ) {
    if (isStartish(topLevelType)) {
      trackedTouchCount += 1
    } else if (isEndish(topLevelType)) {
      if (trackedTouchCount >= 0) {
        trackedTouchCount -= 1
      } else {
        console.error(
          "Ended a touch event which was not counted in `trackedTouchCount`."
        )
        return null
      }
    }

    ResponderTouchHistoryStore.recordTouchTrack(topLevelType, nativeEvent)

    let extracted = canTriggerTransfer(topLevelType, targetInst, nativeEvent)
      ? setResponderAndExtractTransfer(
          topLevelType,
          targetInst,
          nativeEvent,
          nativeEventTarget
        )
      : null

    const isResponderTouchStart = responderInst && isStartish(topLevelType)
    const isResponderTouchMove = responderInst && isMoveish(topLevelType)
    const isResponderTouchEnd = responderInst && isEndish(topLevelType)
    const incrementalTouch = isResponderTouchStart
      ? eventTypes.responderStart
      : isResponderTouchMove
      ? eventTypes.responderMove
      : isResponderTouchEnd
      ? eventTypes.responderEnd
      : null

    if (incrementalTouch) {
      const gesture = ResponderSyntheticEvent.getPooled(
        incrementalTouch,
        responderInst,
        nativeEvent,
        nativeEventTarget
      )
      gesture.touchHistory = ResponderTouchHistoryStore.touchHistory
      accumulateDirectDispatches(gesture)
      extracted = accumulate(extracted, gesture)
    }

    const isResponderTerminate =
      responderInst && topLevelType === TOP_TOUCH_CANCEL
    const isResponderRelease =
      responderInst &&
      !isResponderTerminate &&
      isEndish(topLevelType) &&
      noResponderTouches(nativeEvent)
    const finalTouch = isResponderTerminate
      ? eventTypes.responderTerminate
      : isResponderRelease
      ? eventTypes.responderRelease
      : null
    if (finalTouch) {
      const finalEvent = ResponderSyntheticEvent.getPooled(
        finalTouch,
        responderInst,
        nativeEvent,
        nativeEventTarget
      )
      finalEvent.touchHistory = ResponderTouchHistoryStore.touchHistory
      accumulateDirectDispatches(finalEvent)
      extracted = accumulate(extracted, finalEvent)
      changeResponder(null)
    }

    return extracted
  },

  GlobalResponderHandler: null,

  injection: {
    injectGlobalResponderHandler(GlobalResponderHandler) {
      ResponderEventPlugin.GlobalResponderHandler = GlobalResponderHandler
    }
  }
}

export default ResponderEventPlugin
