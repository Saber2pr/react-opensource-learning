/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import React from 'react'
import invariant from 'shared/invariant'
import warningWithoutStack from 'shared/warningWithoutStack'

type Unsubscribe = () => void

export function createSubscription<Property, Value>(
  config: $ReadOnly<{|
    getCurrentValue: (source: Property) => Value | void,
    subscribe: (
      source: Property,
      callback: (value: Value | void) => void,
    ) => Unsubscribe,
  |}>,
): React$ComponentType<{
  children: (value: Value | void) => React$Node,
  source: Property,
}> {
  const {getCurrentValue, subscribe} = config

  type Props = {
    children: (value: Value) => React$Element<any>,
    source: Property,
  }
  type State = {
    source: Property,
    value: Value | void,
  }

  class Subscription extends React.Component<Props, State> {
    state: State = {
      source: this.props.source,
      value:
        this.props.source != null
          ? getCurrentValue(this.props.source)
          : undefined,
    }

    _hasUnmounted: boolean = false
    _unsubscribe: Unsubscribe | null = null

    static getDerivedStateFromProps(nextProps, prevState) {
      if (nextProps.source !== prevState.source) {
        return {
          source: nextProps.source,
          value:
            nextProps.source != null
              ? getCurrentValue(nextProps.source)
              : undefined,
        }
      }

      return null
    }

    componentDidMount() {
      this.subscribe()
    }

    componentDidUpdate(prevProps, prevState) {
      if (this.state.source !== prevState.source) {
        this.unsubscribe()
        this.subscribe()
      }
    }

    componentWillUnmount() {
      this.unsubscribe()

      //跟踪已安装以避免在卸载后调用setState
      //对于像Promises这样无法取消订阅的来源。
      this._hasUnmounted = true
    }

    render() {
      return this.props.children(this.state.value)
    }

    subscribe() {
      const {source} = this.state
      if (source != null) {
        const callback = (value: Value | void) => {
          if (this._hasUnmounted) {
            return
          }

          this.setState(state => {
            if (value === state.value) return null
            if (source !== state.source) return null

            return {value}
          })
        }

        //存储取消订阅方法以供日后使用（如果可订阅的道具更改）。
        const unsubscribe = subscribe(source, callback)

        //在实例上存储取消订阅是安全的，因为
        //我们只在“提交”阶段读取或写入该属性。
        this._unsubscribe = unsubscribe

        //外部值可能会在渲染和装载之间发生变化
        //在某些情况下，处理这种情况可能很重要
        const value = getCurrentValue(this.props.source)
        if (value !== this.state.value) {
          this.setState({value})
        }
      }
    }

    unsubscribe() {
      if (typeof this._unsubscribe === 'function') {
        this._unsubscribe()
      }
      this._unsubscribe = null
    }
  }

  return Subscription
}
