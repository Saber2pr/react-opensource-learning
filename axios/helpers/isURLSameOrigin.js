'use strict';

var utils = require('./../utils');

module.exports = (
  utils.isStandardBrowserEnv() ?

    //标准浏览器环境完全支持测试所需的API
    //请求URL是否与当前位置的原点相同。
    (function standardBrowserEnv () {
      var msie = /(msie|trident)/i.test(navigator.userAgent);
      var urlParsingNode = document.createElement('a');
      var originURL;

      // 解析URL以发现它的组件
      function resolveURL (url) {
        var href = url;

        if (msie) {
          //IE需要两次属性设置才能规范化属性
          urlParsingNode.setAttribute('href', href);
          href = urlParsingNode.href;
        }

        urlParsingNode.setAttribute('href', href);

        //urlParsingNode提供UrlUtils接口 - http://url.spec.whatwg.org/#urlutils
        return {
          href: urlParsingNode.href,
          protocol: urlParsingNode.protocol ? urlParsingNode.protocol.replace(/:$/, '') : '',
          host: urlParsingNode.host,
          search: urlParsingNode.search ? urlParsingNode.search.replace(/^\?/, '') : '',
          hash: urlParsingNode.hash ? urlParsingNode.hash.replace(/^#/, '') : '',
          hostname: urlParsingNode.hostname,
          port: urlParsingNode.port,
          pathname: (urlParsingNode.pathname.charAt(0) === '/') ?
            urlParsingNode.pathname :
            '/' + urlParsingNode.pathname
        };
      }

      originURL = resolveURL(window.location.href);

      // 确定URL是否与当前位置共享相同的来源
      return function isURLSameOrigin (requestURL) {
        var parsed = (utils.isString(requestURL)) ? resolveURL(requestURL) : requestURL;
        return (parsed.protocol === originURL.protocol &&
          parsed.host === originURL.host);
      };
    })() :

    //非标准浏览器环境（Web worker，react-native）缺乏必要的支持
    (function nonStandardBrowserEnv () {
      return function isURLSameOrigin () {
        return true;
      };
    })()
);
