import { getBatch } from './batch'

// 这个util是个纯观察者模式的实现

// 代替Store
function createListenerCollection () {
  // 获取batch api
  const batch = getBatch()

  // 这里官方注释说是不是需要重构一下，以提高重用性
  // 比如实现为class Store
  const listeners = []

  return {
    clear () {
      listeners.length = 0
    },

    // 广播事件
    notify () {
      // 调用batch api进行批量更新
      batch(() => listeners.forEach(l => l()))
    },

    // 这个api想干什么?
    get = () => listeners,

    subscribe (listener) {
      listeners.push(listener)
      return () => listeners.splice(listeners.indexOf(listener), 1)
    }
  }
}
// 实现的太难看了...
// 为什么不能直接subscription.addNestedSub(checkForUpdates)
// 非要先subscription.onStateChange = checkForUpdates，
// 然后trySubscribe呢？
export default class Subscription {
  /**
   * @param {*} store
   * @param {Subscription} parentSub
   * @memberof Subscription
   */
  constructor(store, parentSub) {
    this.store = store
    this.parentSub = parentSub
    this.unsubscribe = null
    this.listeners = null
  }

  // 代替store.subscribe
  addNestedSub (listener) {
    this.trySubscribe()
    return this.listeners.subscribe(listener)
  }

  // 广播事件
  notifyNestedSubs () {
    this.listeners.notify()
  }

  handleChangeWrapper = () => {
    this.onStateChange && this.onStateChange()
  }

  isSubscribed () {
    return !!this.unsubscribe
  }

  trySubscribe () {
    if (this.isSubscribed()) return

    // 如果有parentSub，说明是下层组件，就在context中的subscription上绑定onStateChange
    if (this.parentSub) {
      this.unsubscribe = this.parentSub.addNestedSub(this.handleChangeWrapper)
    } else {
      // 否则是Provider组件，在store上订阅
      this.unsubscribe = this.store.subscribe(this.handleChangeWrapper)
    }

    this.listeners = createListenerCollection()
  }

  // 清理订阅，释放内存
  tryUnsubscribe () {
    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = null
      this.listeners.clear()
      this.listeners = null
    }
  }
}
