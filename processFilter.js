/**
 * smalldragonluo created at 2015-11-13 11:19:23
 */

var fs = require('fs');
var path = require('path');
var xtpl = require('xtpl');
var exec = require('child_process').exec;
var iconv = require('iconv-lite');
var targetEncoding = 'utf8';
var originEncoding = 'binary';
var iconNames = require('./iconNames');

module.exports = function(query) {
  // 渲染到 Alfred 的列表
  var items = [];

  // 查找进程信息，-c command 栏只包含可执行名称，取其作为 title (Change the command column output to just contain the executable name, rather than the full command line.)
  exec('ps -Ac | grep -i ' + query + ' | grep -v grep', {
    encoding: originEncoding,
    maxBuffer: 1024 * 1024
  }, function(error, stdout, stderr) {
    // 如果出现错误，可能是 ps 未找到相关信息 导致 grep 出错
    if (error) {
      console.log('未找到相关进程');
      return;
    }

    // 再取一次，获得完整的执行路径，包含传入参数
    exec('ps -A | grep -i ' + query + ' | grep -v grep', {
      encoding: originEncoding,
      maxBuffer: 1024 * 1024
    }, function(error2, stdout2, stderr2) {
      if (error) {
        console.error(error.stack);
        return;
      }

      var rows = iconv.decode(new Buffer(stdout, originEncoding), targetEncoding).split(/\n/);
      var rows2 = iconv.decode(new Buffer(stdout2, originEncoding), targetEncoding).split(/\n/);

      // 进程 map，取完整路径与参数用
      var processMap = {};

      for (var i = 0; i < rows2.length; i++) {
        if (rows2[i]) {
          var fields2 = rows2[i].match(/([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+(.+)/);
          var item = {
            pid: fields2[1],
            tt: fields2[2],
            time: fields2[3],
            command: fields2[4]
          };
          processMap[fields2[1]] = item;
        }
      }

      for (var i = 0; i < rows.length; i++) {
        try {
          if (rows[i]) {
            var fields = rows[i].match(/([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+(.+)/);
            var item = {
              pid: fields[1],
              tt: fields[2],
              time: fields[3],
              name: fields[4],
              // 有可能会出现在 processMap 中找不到对应进程号的情况，待寻找原因
              command: processMap[fields[1]] && processMap[fields[1]].command || '',
              isApp: processMap[fields[1]].command.indexOf('.app/Contents') !== -1,
              icon: '/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/ExecutableBinaryIcon.icns'
            };

            if (item.isApp) {
              // 如果是 app
              var suffixIndex = processMap[fields[1]].command.indexOf('.app');
              var appPath = processMap[fields[1]].command.substring(0, suffixIndex + 5);

              item.icon = appPath;
            }

            items.push(item);
          }
        } catch (e) {
          // 有可能会出现在 processMap 中找不到对应进程号的情况，待寻找原因
        }
      }
      xtpl.renderFile('./processItems.xtpl', {
        items: items
      }, function(error, content) {
        console.log(content);
      });
    });
  });
};
