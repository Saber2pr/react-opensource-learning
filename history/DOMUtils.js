export const canUseDOM = !!(
  typeof window !== 'undefined' &&
  window.document &&
  window.document.createElement
)

export function getConfirmation(message, callback) {
  callback(window.confirm(message))
}

/**
 *如果支持HTML5历史记录API，则返回true。取自Modernizr。
 *
 *https://github.com/Modernizr/Modernizr/blob/master/LICENSE
 *https://github.com/Modernizr/Modernizr/blob/master/feature-detects/history.js
 *更改为避免Windows Phone的误报：https：//github.com/reactjs/react-router/issues/586
 */ 
export function supportsHistory() {
  const ua = window.navigator.userAgent

  if (
    (ua.indexOf('Android 2.') !== -1 || ua.indexOf('Android 4.0') !== -1) &&
    ua.indexOf('Mobile Safari') !== -1 &&
    ua.indexOf('Chrome') === -1 &&
    ua.indexOf('Windows Phone') === -1
  )
    return false

  return window.history && 'pushState' in window.history
}

/**
 *如果浏览器在哈希更改时触发popstate，则返回true。
 *IE10和IE11没有。
 */
export function supportsPopStateOnHashChange() {
  return window.navigator.userAgent.indexOf('Trident') === -1
}

/**
 *如果使用带有哈希历史记录的go（n）导致整页重新加载，则返回false。
 */
export function supportsGoWithoutReloadUsingHash() {
  return window.navigator.userAgent.indexOf('Firefox') === -1
}

/**
 *如果给定的popstate事件是无关的WebKit事件，则返回true。
 *说明iOS上的Chrome会触发真正的popstate事件
 *按下后退按钮时包含未定义状态。
 */ 
export function isExtraneousPopstateEvent(event) {
  return event.state === undefined && navigator.userAgent.indexOf('CriOS') === -1
}
