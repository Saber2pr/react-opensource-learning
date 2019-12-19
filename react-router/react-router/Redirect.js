import React from "react"
import { createLocation, locationsAreEqual } from "history"

import Lifecycle from "./Lifecycle"
import RouterContext from "./RouterContext"
import generatePath from "./generatePath"

// Redirect干了什么
// 根据to属性计算一个path，然后向history push
// 简单讲就是history.push(to)

// Redirect必须在Router内层使用
// Redirect不会渲染组件
// Redirect不会创建监听器
// Redirect需要一个computedMatch属性，可以手动创建，也可以由上层Switch组件创建

function Redirect({ computedMatch, to, push = false }) {
  return (
    <RouterContext.Consumer>
      {context => {
        const { history, staticContext } = context
        const method = push ? history.push : history.replace

        let path
        if(computedMatch) {
          if(typeof to === "string") {
            path = generatePath(to, computedMatch.params)
          }else {
            path = {
              ...to,
              pathname: generatePath(to.pathname, computedMatch.params)
            }
          }
        }else {
          path = to
        }

        const location = createLocation(path)

        //在静态上下文中渲染时
        //立即设置新位置。 
        // 使用了StaticRouter会传下来staticContext
        if (staticContext) {
          method(location)
          return null
        }

        return (
          <Lifecycle
            onMount={() => method(location)}
            onUpdate={(self, prevProps) => {
              const prevLocation = createLocation(prevProps.to)
              if (
                !locationsAreEqual(prevLocation, {
                  ...location,
                  key: prevLocation.key
                })
              ) {
                method(location)
              }
            }}
            to={to}
          />
        )
      }}
    </RouterContext.Consumer>
  )
}

export default Redirect
