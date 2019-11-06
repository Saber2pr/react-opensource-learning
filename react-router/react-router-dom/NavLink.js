import React from "react"
import { __RouterContext as RouterContext, matchPath } from "react-router"
import Link from "./Link"
import { resolveToLocation, normalizeToLocation } from "./utils/locationUtils"

function joinClassnames(...classnames) {
  return classnames.filter(i => i).join(" ")
}

// 不应该在<Router>之外使用<NavLink>
// 知道自己激活的anchor activeStyle
function NavLink({
  "aria-current": ariaCurrent = "page",
  activeClassName = "active",
  activeStyle,
  className: classNameProp,
  exact,
  isActive: isActiveProp,
  location: locationProp,
  strict,
  style: styleProp,
  to,
  ...rest
}) {
  return (
    <RouterContext.Consumer>
      {context => {
        const currentLocation = locationProp || context.location
        const { pathname: pathToMatch } = currentLocation

        const toLocation = normalizeToLocation(
          resolveToLocation(to, currentLocation),
          currentLocation
        )
        
        const { pathname: path } = toLocation
        const escapedPath =
          path && path.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1")

        const match = escapedPath
          ? matchPath(pathToMatch, { path: escapedPath, exact, strict })
          : null

        const isActive = !!(isActiveProp
          ? isActiveProp(match, context.location)
          : match)

        const className = isActive
          ? joinClassnames(classNameProp, activeClassName)
          : classNameProp
        
        const style = isActive ? { ...styleProp, ...activeStyle } : styleProp

        return (
          <Link
            aria-current={(isActive && ariaCurrent) || null}
            className={className}
            style={style}
            to={toLocation}
            {...rest}
          />
        )
      }}
    </RouterContext.Consumer>
  )
}

export default NavLink
