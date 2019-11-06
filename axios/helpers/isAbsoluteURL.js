'use strict';

// 确定指定的URL是否是绝对的
module.exports = function isAbsoluteURL (url) {
  //如果URL以“<scheme>：//”或“//”（协议相对URL）开头，则该URL被视为绝对值。
  //RFC 3986将方案名称定义为以字母开头并跟随的字符序列
  //由字母，数字，加号，句号或连字符的任意组合组成。
  return /^([a-z][a-z\d\+\-\.]*:)?\/\//i.test(url);
};
