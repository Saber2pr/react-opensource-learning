import React from "react"

// 生命周期代理
// 不会渲染props
// componentDidMount -> onMount
// componentDidUpdate -> onUpdate
// componentWillUnmount -> onUnmount
class Lifecycle extends React.Component {
  componentDidMount() {
    if (this.props.onMount) this.props.onMount.call(this, this)
  }

  componentDidUpdate(prevProps) {
    if (this.props.onUpdate) this.props.onUpdate.call(this, this, prevProps)
  }

  componentWillUnmount() {
    if (this.props.onUnmount) this.props.onUnmount.call(this, this)
  }

  render() {
    return null
  }
}

export default Lifecycle
