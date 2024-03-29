import React from "react"
import { __RouterContext as RouterContext } from "react-router"
import PropTypes from "prop-types"
import invariant from "tiny-invariant"
import { resolveToLocation, normalizeToLocation } from "./utils/locationUtils"

function isModifiedEvent(event) {
  return !!(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey)
}

function LinkAnchor({ innerRef, navigate, onClick, ...rest }) {
  const { target } = rest

  return (
    <a
      {...rest}
      ref={innerRef}
      onClick={event => {
        try {
          if (onClick) onClick(event)
        } catch (ex) {
          event.preventDefault()
          throw ex
        }

        if (
          !event.defaultPrevented && // onClick prevented default
          event.button === 0 && // ignore everything but left clicks
          (!target || target === "_self") && // let browser handle "target=_blank" etc.
          !isModifiedEvent(event) // ignore clicks with modifier keys
        ) {
          event.preventDefault()
          navigate()
        }
      }}
    />
  )
}

// 不应该在<Router>之外使用<Link> 
function Link({ component = LinkAnchor, replace, to, ...rest }) {
  return (
    <RouterContext.Consumer>
      {context => {
        const { history } = context

        const location = normalizeToLocation(
          resolveToLocation(to, context.location),
          context.location
        )

        const href = location ? history.createHref(location) : ""

        return React.createElement(component, {
          ...rest,
          href,
          navigate() {
            const location = resolveToLocation(to, context.location)
            const method = replace ? history.replace : history.push

            method(location)
          }
        })
      }}
    </RouterContext.Consumer>
  )
}

export default Link
