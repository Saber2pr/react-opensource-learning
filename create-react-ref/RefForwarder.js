import React from "react"
import createRef from "./createRef"

export default class ForwardRefPolyfill extends React.Component {
  static displayName = "ForwardRefPolyfill"

  constructor(props) {
    super(props)
    this.__forwardedRef = createRef()
  }

  __render() {
    return null
  }

  getRef() {
    return this.__forwardedRef.current || this.__forwardedRef.value
  }

  render() {
    return this.__render(this.props, this.__forwardedRef)
  }
}
