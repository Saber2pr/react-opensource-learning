import React from "react"

import RouterContext from "./RouterContext"
import matchPath from "./matchPath"

// Switch干了什么
// 从上到下找到匹配的第一个child并渲染它

class Switch extends React.Component {
  render() {
    return (
      <RouterContext.Consumer>
        {context => {
          const location = this.props.location || context.location
          let element, match

          //我们使用React.Children.forEach而不是React.Children.toArray().find()
          // 因为toArray为所有子元素添加了键。
          // 我们不想要让两个呈现相同的<Route>都触发unmount/remount

          // 遍历Switch children
          // 匹配第一个child
          React.Children.forEach(this.props.children, child => {
            // 只匹配一次
            if (match == null && React.isValidElement(child)) {
              element = child

              // path来自Route，from来自Redirect
              const path = child.props.path || child.props.from

              match = path
                ? matchPath(location.pathname, { ...child.props, path })
                : context.match
            }
          })

          /**
           * matched {
           *   path: string
           *   url: string
           *   isExact: boolean
           *   params: object
           * }
           */
          return match
            ? React.cloneElement(element, { location, computedMatch: match })
            : null
        }}
      </RouterContext.Consumer>
    )
  }
}

export default Switch
