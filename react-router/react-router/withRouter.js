import React from "react"

import RouterContext from "./RouterContext"
import hoistStatics from "hoist-non-react-statics"

// withRouter干了什么
// 将RouterContext通过props传递到Component
// 这里可以用useContext的

function withRouter(Component) {
  const C = props => {
    const { wrappedComponentRef, ...remainingProps } = props

    return (
      <RouterContext.Consumer>
        {context => 
          <Component
            {...remainingProps}
            {...context}
            ref={wrappedComponentRef}
          />}
      </RouterContext.Consumer>
    )
  }

  return hoistStatics(C, Component)
}

export default withRouter
