'use strict';

var utils = require('./utils');
var Axios = require('./core/Axios');
var mergeConfig = require('./core/mergeConfig');
var defaults = require('./defaults');

// createInstance: config => Axios & Axios['request']
function createInstance (defaultConfig) {
  var context = new Axios(defaultConfig);

  // instance: config => Promise
  var instance = Axios.prototype.request.bind(context)

  // instance是个function。将Axios上的属性拷贝到instance上。
  // 即可以实现这样调用：axios(config)，axios.interceptors

  // 拷贝Axios原型属性到实例
  utils.extend(instance, Axios.prototype, context);
  // 拷贝Axios静态属性到实例
  utils.extend(instance, context);

  return instance;
}

// 创建要导出的默认实例 
var axios = createInstance(defaults);

// 公开Axios类以允许类继承
axios.Axios = Axios;

// 用于创建新实例的工厂
axios.create = (instanceConfig) => {
  const config = mergeConfig(axios.defaults, instanceConfig)
  createInstance(config);
}

// Expose Cancel & CancelToken
axios.Cancel = require('./cancel/Cancel');
axios.CancelToken = require('./cancel/CancelToken');
axios.isCancel = require('./cancel/isCancel');

// Expose all/spread
axios.all = Promise.all

axios.spread = require('./helpers/spread');

module.exports = axios;

// default属性，兼容TS import default语法
module.exports.default = axios;
