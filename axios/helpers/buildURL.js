'use strict';

var utils = require('./../utils');


// /i (忽略大小写)
// /g (全文查找出现的所有匹配字符)
// /m (多行查找)
// /gi(全文查找、忽略大小写) === /ig

// 加密URI，但保持几个特殊字符
function encode (val) {
  return encodeURIComponent(val).
    replace(/%40/gi, '@').
    replace(/%3A/gi, ':').
    replace(/%24/g, '$').
    replace(/%2C/gi, ',').
    replace(/%20/g, '+').
    replace(/%5B/gi, '[').
    replace(/%5D/gi, ']');
}

module.exports = function buildURL (url, params, paramsSerializer) {
  if (!params) return url;

  let serializedParams

  if (paramsSerializer) {
    // 如果有params序列化工具函数
    serializedParams = paramsSerializer(params);

  } else if (utils.isURLSearchParams(params)) {
    // 如果params是URLSearchParams类型，则直接toString
    serializedParams = params.toString();

  } else {
    // 将params对象序列化

    const parts = []

    utils.forEach(params, (val, key) => {
      if (val === null || typeof val === 'undefined') return;

      if (utils.isArray(val)) {
        // params: { likes: ['a', 'b'] } -> "likes[]=a&likes[]=b"
        key = key + '[]';
      } else {
        val = [val]; // 归一化处理，下文以val为Array类型处理
      }

      utils.forEach(val, v => {
        if (utils.isDate(v)) {
          // 如果是时间对象则toString
          v = v.toISOString();

        } else if (utils.isObject(v)) {
          v = JSON.stringify(v);
        }

        parts.push(encode(key) + '=' + encode(v));
      });
    });

    serializedParams = parts.join('&');
  }

  if (serializedParams) {
    let hashmarkIndex = url.indexOf('#');

    // 去掉hash部分
    if (hashmarkIndex !== -1) url = url.slice(0, hashmarkIndex);

    // 判断params是create还是append
    url += (url.indexOf('?') === -1 ? '?' : '&') + serializedParams;
  }

  return url;
};
