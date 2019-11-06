import React from "react"

import RouterContext from "./RouterContext"
import matchPath from "./matchPath"

function isEmptyChildren(children) {
  return React.Children.count(children) === 0
}

// Route干了什么
// 用path属性与当前location做匹配
// 匹配就渲染component，如果不匹配就渲染null

class Route extends React.Component {
  render() {
    return (
      <RouterContext.Consumer>
        {context => {
          // history变化后，Router推送location到Routes
          // 从Router传下来的location
          const location = this.props.location || context.location

          let match
          if(this.props.computedMatch) {
            // 上层有Switch
            //<Switch>已经为我们计算了匹配 
            match = this.props.computedMatch
          }else{
            if(this.props.path){
              // 将当前Route组件path与当前location做匹配
              match = matchPath(location.pathname, this.props)
            }else{
              // 如果这个Route组件没有path属性
              // context.match就是根路由
              match = context.match
            }
          }

          const props = { ...context, location, match }
          let { children, component, render } = this.props

          //Preact使用空数组作为子项默认，所以如果是这样的话，请使用null。 
          if (Array.isArray(children) && children.length === 0) {
            children = null
          }

          if (typeof children === "function") {
            children = children(props)
          }

          let childrenRendered = null

          if(children && !isEmptyChildren(children)) {
            // 如果<Route/>有children，则不匹配直接渲染children
            childrenRendered = children
          }else{
            if(props.match) { // 如果location与当前Route组件匹配
              if(component) {
                // <Component {...props}/>
                childrenRendered = React.createElement(component, props)
              }else {
                // 如果不是用的component属性，而是用render props
                if(render) childrenRendered = render(props)
              }
            }
          }

          // location与当前location匹配就渲染component
          // 如果不匹配就渲染null
          return (
            <RouterContext.Provider value={props}>
              {childrenRendered}
            </RouterContext.Provider>
          )
        }}
      </RouterContext.Consumer>
    )
  }
}

export default Route
