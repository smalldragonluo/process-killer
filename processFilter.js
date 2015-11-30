/**
 * smalldragonluo created at 2015-11-13 11:19:23
 */

var path = require('path');
var xtpl = require('xtpl');
var exec = require('child_process').exec;
var iconv = require('iconv-lite');
var targetEncoding = 'utf8';
var originEncoding = 'binary';

module.exports = function(query) {
  // 渲染到 Alfred 的列表
  var params = query.match(/\s*(-i\s+(\d+)\s*)|(.+)/);

  if (!params) {
    return;
  }

  // 将空格转义
  if (params[3]) {
    params[3] = params[3].replace(/\s/, '\\ ');
  }

  if (params[2]) {
    exec('lsof -i4:' + params[2] + (params[3] ? ' | grep ' + params[3] : ''), {
      encoding: originEncoding,
      maxBuffer: 1024 * 1024
    }, function(error, stdout, stderr) {
      var infoRows = iconv.decode(new Buffer(stdout, originEncoding), targetEncoding).split(/\n/);
      var pids = [];

      for (var i = 0; i < infoRows.length; i++) {
        var params = infoRows[i].match(/^[^\d]+(\d+)/);

        if (params) {
          pids.push(params[1]);
        }
      }

      getProcessInfo('\'' + pids.join('\\|') + '\'').then(function(items) {
        xtpl.renderFile('./processItems.xtpl', {
          items: items
        }, function(error, content) {
          console.log(content);
        });
      });
    });
  } else {
    getProcessInfo(params[3]).then(function(items) {
      xtpl.renderFile('./processItems.xtpl', {
        items: items
      }, function(error, content) {
        console.log(content);
      });
    });
  }
};

/**
 * 获取进程信息
 * -c command 栏只包含可执行名称(Change the command column output to just contain the executable name, rather than the full command line.)
 * @param identifier 可以是进程id、进程名称
 * @returns {Promise}
 */
function getProcessInfo(identifier) {
  return new Promise(function(resolve, reject) {
    var items = [];

    // 获取参数
    exec('ps -eo pid -o args | grep -i ' + identifier + ' | grep -v grep', {
      encoding: originEncoding,
      maxBuffer: 1024 * 1024
    }, function(error, stdout, stderr) {
      if (error) {
        console.error('应该是没找到进程信息');
        reject(error);
      }

      // 生成 args map
      var argsRows = iconv.decode(new Buffer(stdout, originEncoding), targetEncoding).split(/\n/);
      var argsMap = {};

      for (var i = 0; i < argsRows.length; i++) {
        if (argsRows[i]) {
          var fields = argsRows[i].match(/(\d+)\s+(.+)/);
          argsMap[fields[1]] = fields[2];
        }
      }

      // 获取 command
      exec('ps -eo pid -o comm | grep -i ' + identifier + ' | grep -v grep', {
        encoding: originEncoding,
        maxBuffer: 1024 * 1024
      }, function(error, stdout, stderr) {
        if (error) {
          console.error('应该是没找到进程信息');
          reject(error);
        }

        var commandRows = iconv.decode(new Buffer(stdout, originEncoding), targetEncoding).split(/\n/);

        for (var i = 0; i < commandRows.length; i++) {
          if (commandRows[i]) {
            var fields = commandRows[i].match(/(\d+)\s+(.+)/);

            var lastIndexOfSlash = fields[2].lastIndexOf('\/');
            var item = {
              pid: fields[1],
              command: fields[2],
              name: fields[2].substring(lastIndexOfSlash === -1 ? 0 : lastIndexOfSlash + 1, fields[2].length),
              args: argsMap[fields[1]],
              isApp: fields[2].indexOf('.app/Contents') !== -1,
              icon: '/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/ExecutableBinaryIcon.icns'
            };

            if (item.isApp) {
              // 如果是 app
              item.icon = item.command.substring(0, item.command.indexOf('.app') + 5);
            }

            items.push(item);
          }
        }

        resolve(items);
      });
    });
  });
}