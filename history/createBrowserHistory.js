import { createLocation } from './LocationUtils'
import {
  addLeadingSlash,
  stripTrailingSlash,
  hasBasename,
  stripBasename,
  createPath
} from './PathUtils'
import createTransitionManager from './createTransitionManager'
import {
  canUseDOM,
  getConfirmation,
  supportsHistory,
  supportsPopStateOnHashChange,
  isExtraneousPopstateEvent
} from './DOMUtils'

const PopStateEvent = 'popstate'
const HashChangeEvent = 'hashchange'

function getHistoryState() {
  try {
    return window.history.state || {}
  } catch (e) {
    //访问window.history.state时，IE 11有时会抛出
    //请参阅https://github.com/ReactTraining/history/pull/289
    return {}
  }
}

/**
 *创建使用HTML5历史记录API的历史记录对象
 *pushState，replaceState和popstate事件。
 */ 
function createBrowserHistory(props = {}) {
  const globalHistory = window.history
  const needsHashChangeListener = !supportsPopStateOnHashChange()

  const {
    forceRefresh = false,
    getUserConfirmation = getConfirmation,
    keyLength = 6
  } = props
  const basename = props.basename
    ? stripTrailingSlash(addLeadingSlash(props.basename))
    : ''

  function getDOMLocation(historyState) {
    const { key, state } = historyState || {}
    const { pathname, search, hash } = window.location

    let path = pathname + search + hash

    if (basename) path = stripBasename(path, basename)

    return createLocation(path, state, key)
  }

  function createKey() {
    return Math.random()
      .toString(36)
      .substr(2, keyLength)
  }

  const transitionManager = createTransitionManager()

  function setState(nextState) {
    Object.assign(history, nextState)
    history.length = globalHistory.length
    transitionManager.notifyListeners(history.location, history.action)
  }

  function handlePopState(event) {
    //忽略WebKit中无关的popstate事件。 
    if (isExtraneousPopstateEvent(event)) return
    handlePop(getDOMLocation(event.state))
  }

  function handleHashChange() {
    handlePop(getDOMLocation(getHistoryState()))
  }

  let forceNextPop = false

  function handlePop(location) {
    if (forceNextPop) {
      forceNextPop = false
      setState()
    } else {
      const action = 'POP'

      transitionManager.confirmTransitionTo(
        location,
        action,
        getUserConfirmation,
        ok => {
          if (ok) {
            setState({ action, location })
          } else {
            revertPop(location)
          }
        }
      )
    }
  }

  function revertPop(fromLocation) {
    const toLocation = history.location

    let toIndex = allKeys.indexOf(toLocation.key)
    if (toIndex === -1) toIndex = 0

    let fromIndex = allKeys.indexOf(fromLocation.key)
    if (fromIndex === -1) fromIndex = 0

    const delta = toIndex - fromIndex

    if (delta) {
      forceNextPop = true
      go(delta)
    }
  }

  const initialLocation = getDOMLocation(getHistoryState())
  let allKeys = [initialLocation.key]

  function createHref(location) {
    return basename + createPath(location)
  }

  function push(path, state) {
    const action = 'PUSH'
    const location = createLocation(path, state, createKey(), history.location)

    transitionManager.confirmTransitionTo(
      location,
      action,
      getUserConfirmation,
      ok => {
        if (!ok) return

        const href = createHref(location)
        const { key, state } = location

        globalHistory.pushState({ key, state }, null, href)

        if (forceRefresh) {
          window.location.href = href
        } else {
          const prevIndex = allKeys.indexOf(history.location.key)
          const nextKeys = allKeys.slice(0, prevIndex + 1)

          nextKeys.push(location.key)
          allKeys = nextKeys

          setState({ action, location })
        }
      }
    )
  }

  function replace(path, state) {
    const action = 'REPLACE'
    const location = createLocation(path, state, createKey(), history.location)

    transitionManager.confirmTransitionTo(
      location,
      action,
      getUserConfirmation,
      ok => {
        if (!ok) return

        const href = createHref(location)
        const { key, state } = location

        globalHistory.replaceState({ key, state }, null, href)

        if (forceRefresh) {
          window.location.replace(href)
        } else {
          const prevIndex = allKeys.indexOf(history.location.key)
          if (prevIndex !== -1) allKeys[prevIndex] = location.key

          setState({ action, location })
        }
      }
    )
  }

  const go = n => globalHistory.go(n)
  const goBack = () => go(-1)
  const goForward = () => go(1)

  let listenerCount = 0

  function checkDOMListeners(delta) {
    listenerCount += delta

    if (listenerCount === 1 && delta === 1) {
      window.addEventListener(PopStateEvent, handlePopState)

      if (needsHashChangeListener)
        window.addEventListener(HashChangeEvent, handleHashChange)
    } else if (listenerCount === 0) {
      window.removeEventListener(PopStateEvent, handlePopState)

      if (needsHashChangeListener)
        window.removeEventListener(HashChangeEvent, handleHashChange)
    }
  }

  let isBlocked = false

  function block(prompt = false) {
    const unblock = transitionManager.setPrompt(prompt)

    if (!isBlocked) {
      checkDOMListeners(1)
      isBlocked = true
    }

    return () => {
      if (isBlocked) {
        isBlocked = false
        checkDOMListeners(-1)
      }

      return unblock()
    }
  }

  function listen(listener) {
    const unlisten = transitionManager.appendListener(listener)
    checkDOMListeners(1)

    return () => {
      checkDOMListeners(-1)
      unlisten()
    }
  }

  return {
    length: globalHistory.length,
    action: 'POP',
    location: initialLocation,
    createHref,
    push,
    replace,
    go,
    goBack,
    goForward,
    block,
    listen
  }
}

export default createBrowserHistory
