import pathToRegexp from "path-to-regexp"
/**
 * pathToRegexp API 文档
 * ```js
 * const keys = []
 * const regexp = pathToRegexp('/foo/:bar', keys)
 * // regexp = /^\/foo\/([^\/]+?)\/?$/i
 * // keys = [{ name: 'bar', prefix: '/', delimiter: '/', optional: false, repeat: false, pattern: '[^\\/]+?' }]
 * ```
 */

const cache = {}
const cacheLimit = 10000 // 缓存最大限制
let cacheCount = 0

function compilePath(path, options) {
  const cacheKey = `${options.end}${options.strict}${options.sensitive}`
  const pathCache = cache[cacheKey] || (cache[cacheKey] = {})

  // memorize优化
  if (pathCache[path]) return pathCache[path]

  const keys = []
  const regexp = pathToRegexp(path, keys, options)
  const result = { regexp, keys }

  if (cacheCount < cacheLimit) {
    pathCache[path] = result
    cacheCount++
  }

  return result
}

/**
 * matched {
 *   path: string
 *   url: string
 *   isExact: boolean
 *   params: object
 * }
 */
function matchPath(pathname, options = {}) {
  if (typeof options === "string" || Array.isArray(options)) {
    options = { path: options }
  }

  const { path, exact = false, strict = false, sensitive = false } = options

  const paths = [].concat(path)

  // 这个reduce没有acc
  // 这个reduce相当于可以return出值的forEach
  // 直到计算出非null值
  return paths.reduce((matched, path) => {
    if (!path) return null
    if (matched) return matched // 

    const { regexp, keys } = compilePath(path, {
      end: exact,
      strict,
      sensitive
    })
    const match = regexp.exec(pathname)

    if (!match) return null

    const [url, ...values] = match
    const isExact = pathname === url

    // 严格匹配
    // 如果exact=true并且pathname和路由正则匹配结果不一致，则返回null
    if (exact && !isExact) return null

    return {
      path,
      url: path === "/" && url === "" ? "/" : url,
      isExact,
      params: keys.reduce((memo, key, index) => {
        memo[key.name] = values[index]
        return memo
      }, {})
    }
  }, null)
}

export default matchPath
