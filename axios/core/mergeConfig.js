'use strict';

var utils = require('../utils');

module.exports = function mergeConfig (config1, config2) {
  config2 = config2 || {};
  var config = {};

  // 将config2上['url', 'method', 'params', 'data']的属性拷贝过来
  utils.forEach(['url', 'method', 'params', 'data'], function valueFromConfig2 (prop) {
    if (typeof config2[prop] !== 'undefined') {
      config[prop] = config2[prop];
    }
  });

  utils.forEach(['headers', 'auth', 'proxy'], function mergeDeepProperties (prop) {
    if (utils.isObject(config2[prop])) {
      // 如果是config2.prop是对象，就深拷贝
      config[prop] = utils.deepMerge(config1[prop], config2[prop]);

    } else if (typeof config2[prop] !== 'undefined') {
      // 如果config2.prop不是对象，但存在，则直接复制过来
      config[prop] = config2[prop];

    } else if (utils.isObject(config1[prop])) {
      // 如果config2.prop不是对象，且不存在
      config[prop] = utils.deepMerge(config1[prop]);

    } else if (typeof config1[prop] !== 'undefined') {
      config[prop] = config1[prop];
    }
  });

  utils.forEach([
    'baseURL', 'transformRequest', 'transformResponse', 'paramsSerializer',
    'timeout', 'withCredentials', 'adapter', 'responseType', 'xsrfCookieName',
    'xsrfHeaderName', 'onUploadProgress', 'onDownloadProgress', 'maxContentLength',
    'validateStatus', 'maxRedirects', 'httpAgent', 'httpsAgent', 'cancelToken',
    'socketPath'
  ], prop => {
    if (typeof config2[prop] !== 'undefined') {
      config[prop] = config2[prop];

    } else if (typeof config1[prop] !== 'undefined') {
      config[prop] = config1[prop];
    }
  });

  return config;
};
