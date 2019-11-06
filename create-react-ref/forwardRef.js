import React from "react"
import createRef from "./createRef"
import RefForwarder from "./RefForwarder"

export default React.forwardRef ||
  function forwardRef(render) {
    return class extends RefForwarder {
      __render = render
    }
  }
