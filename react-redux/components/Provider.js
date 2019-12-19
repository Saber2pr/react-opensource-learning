import React, { Component } from 'react'
import { ReactReduxContext } from './Context'
import Subscription from '../utils/Subscription'

class Provider extends Component {
  constructor(props) {
    super(props)

    // 从props中拿到store
    const { store } = props

    this.notifySubscribers = this.notifySubscribers.bind(this)

    // Subscription内部让store订阅subscription.onStateChange
    // store每次dispatch时会触发onStateChange
    const subscription = new Subscription(store)

    // subscription.onStateChange绑定subscription.notifyNestedSubs
    // 对于Provider来说，没有parentSub，所以就是store.subscribe(() => subscription.notifyNestedSubs())
    // 而对于下层组件是context.subscription.addNestedSub(() => subscription.notifyNestedSubs())
    // 对于Provider(组件顶层)，onStateChange绑定subscription.notifyNestedSubs
    // 对于下层组件，onStateChange绑定checkForUpdates
    // 所以，所有的组件会把自己的checkForUpdates注册到Provider里的subscription，
    // 然后Provider再把store和subscription建立关联(即store.subscribe(() => subscription.notifyNestedSubs()))
    // 所以说store里只注册了一个监听器，组件们的监听器都在Provider::subscription里
    subscription.onStateChange = this.notifySubscribers

    this.state = {
      store,
      subscription
    }

    this.previousState = store.getState()
  }

  componentDidMount () {
    // 初始化订阅
    this.state.subscription.trySubscribe()

    if (this.previousState !== this.props.store.getState()) {
      // 通知订阅者
      this.state.subscription.notifyNestedSubs()
    }
  }

  componentWillUnmount () {
    // 取消订阅
    if (this.unsubscribe) this.unsubscribe()
    // 释放内存
    this.state.subscription.tryUnsubscribe()
  }

  componentDidUpdate (prevProps) {
    // 如果动态更改了store
    if (this.props.store !== prevProps.store) {
      // 释放内存
      this.state.subscription.tryUnsubscribe()
      // 构造新的subscription
      const subscription = new Subscription(this.props.store)
      subscription.onStateChange = this.notifySubscribers
      // 更新state， 即context值
      this.setState({ store: this.props.store, subscription })
    }
  }

  // 通知订阅者
  notifySubscribers () {
    this.state.subscription.notifyNestedSubs()
  }

  render () {
    // 上下文，绑定value = state然后向下传递
    const Context = this.props.context || ReactReduxContext

    return (
      <Context.Provider value={this.state}>
        {this.props.children}
      </Context.Provider>
    )
  }
}

export default Provider
