import pathToRegexp from "path-to-regexp"
/**
 * compile API 文档
 * ```js
 * const toPath = pathToRegexp.compile('/user/:id')
 * toPath({ id: 123 }) // => "/user/123"
 * ```
 */


const cache = {}
const cacheLimit = 10000 // 缓存最大限制
let cacheCount = 0

// compilePath::String -> Function
function compilePath(path) {
  // memorize优化
  if (cache[path]) return cache[path]

  const generator = pathToRegexp.compile(path)

  if (cacheCount < cacheLimit) {
    cache[path] = generator
    cacheCount++
  }

  return generator
}
// generatePath: (path, params) => string
function generatePath(path = "/", params = {}) {
  return path === "/" ? path : compilePath(path)(params, { pretty: true })
}

export default generatePath
