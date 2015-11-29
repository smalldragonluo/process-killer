/**
 * smalldragonluo created at 2015-11-13 11:19:45
 */

var exec = require('child_process').exec;

module.exports = function(query) {
  // 杀死对应进程号的
  exec('kill ' + query, function(error, stdout, stderr) {

  });

  // 5 秒强制退出
  setTimeout(function() {
    exec('kill -9 ' + query, function(error, stdout, stderr) {

    });
  }, 5000);
};
