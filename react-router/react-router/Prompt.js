import React from "react"

import Lifecycle from "./Lifecycle"
import RouterContext from "./RouterContext"

// Prompt组件作用：在用户准备离开该页面时, 弹出提示。
// 返回true或者false, 
// 如果为true, 则离开页面, 
// 如果为false, 则停留在该页面

function Prompt({ message, when = true }) {
  return (
    <RouterContext.Consumer>
      {context => {
        invariant(context, "You should not use <Prompt> outside a <Router>")

        if (!when || context.staticContext) return null

        const method = context.history.block

        return (
          <Lifecycle
            onMount={self => {
              self.release = method(message)
            }}
            
            onUpdate={(self, prevProps) => {
              if (prevProps.message !== message) {
                self.release()
                self.release = method(message)
              }
            }}

            onUnmount={self => self.release()}
            message={message}
          />
        )
      }}
    </RouterContext.Consumer>
  )
}

export default Prompt
