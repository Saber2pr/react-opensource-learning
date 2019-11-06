'use strict';

var utils = require('./../utils')
var buildURL = require('../helpers/buildURL')
var InterceptorManager = require('./InterceptorManager')
var dispatchRequest = require('./dispatchRequest')
var mergeConfig = require('./mergeConfig')

/**
 * Axios {
 *   static defaults: Config
 *   static interceptors
 *   request: config => Promise
 *   getUri: config => urlStringWithParams
 * }
 */

/**
 * Create a new instance of Axios
 *
 * @param {Object} instanceConfig The default config for the instance
 */
function Axios (instanceConfig) {
  this.defaults = instanceConfig;
  this.interceptors = {
    request: new InterceptorManager(),
    response: new InterceptorManager()
  };
}

Axios.prototype.request = function request (config) {
  if (typeof config === 'string') {
    config = arguments[1] || {}
    config.url = arguments[0]
  } else {
    config = config || {}
  }

  // 与全局默认config合并
  config = mergeConfig(this.defaults, config)

  // config.method格式化为小写。默认get请求。
  config.method = config.method ? config.method.toLowerCase() : 'get'

  // 连接拦截器中间件
  // chain: (fulfilled|rejected)[]
  const chain = [dispatchRequest, undefined]
  let promise = Promise.resolve(config)

  // interceptor {
  //   fulfilled
  //   rejected
  // }
  this.interceptors.request.forEach(interceptor => chain.unshift(interceptor.fulfilled, interceptor.rejected))
  this.interceptors.response.forEach(interceptor => chain.push(interceptor.fulfilled, interceptor.rejected))

  // 这个拦截器实现的也是..醉了
  // 有的async/await不用，非要自己去模拟异步堆栈。
  // 建议就是重写成koa-compose那样的。
  // 还有这里强行异步，用reduce同步处理不也可以吗？
  while (chain.length) {
    promise = promise.then(chain.shift(), chain.shift())
  }

  return promise
}

Axios.prototype.getUri = function getUri (config) {
  config = mergeConfig(this.defaults, config)
  return buildURL(config.url, config.params, config.paramsSerializer).replace(/^\?/, '')
};

// 在Axios实例上创建4种基本请求
utils.forEach(['delete', 'get', 'head', 'options'], method => {
  Axios.prototype[method] = (url, config) => this.request(utils.merge(config || {}, {
    method: method,
    url: url
  }))
})

// 在Axios实例上创建3种基本请求
utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData (method) {
  Axios.prototype[method] = (url, data, config) => this.request(utils.merge(config || {}, {
    method: method,
    url: url,
    data: data
  }))
})

module.exports = Axios
