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

module.exports = function(query) {
  // 渲染到 Alfred 的列表
  var items = [];

  // 查找进程信息，-c command 栏只包含可执行名称，取其作为 title (Change the ``command'' column output to just contain the executable name, rather than the full command line.)
  exec('ps -Ac | grep ' + query + ' | grep -v grep', {
    encoding: originEncoding,
    maxBuffer: 1024 * 1024
  }, function(error, stdout, stderr) {
    // 如果出现错误，可能是 ps 未找到相关信息 导致 grep 出错
    if (error) {
      console.error(error.stack);
      return;
    }

    // 再取一次，获得完整的执行路径，包含传入参数
    exec('ps -A | grep ' + query + ' | grep -v grep', {
      encoding: originEncoding,
      maxBuffer: 1024 * 1024
    }, function(error2, stdout2, stderr2) {
      if (error) {
        console.error(error.stack);
        return;
      }

      var rows = iconv.decode(new Buffer(stdout, originEncoding), targetEncoding).split(/\n/);
      var rows2 = iconv.decode(new Buffer(stdout2, originEncoding), targetEncoding).split(/\n/);

      // [debug] 写 stdout 到本地文件
      fs.writeFileSync('./debug.txt', stdout + '\n' + stdout2);

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
        if (rows[i]) {
          var fields = rows[i].match(/([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+(.+)/);
          var item = {
            pid: fields[1],
            tt: fields[2],
            time: fields[3],
            name: fields[4],
            // 有可能会出现在 processMap 中找不到对应进程号的情况，待寻找原因
            command: processMap[fields[1]] && processMap[fields[1]].command || '',
            icon: './86185AA6-ABD0-41DD-B98E-23A096E5310F.png'
          };

          // 如果是 app
          var suffixIndex = processMap[fields[1]].command.indexOf('.app/Contents');
          if (suffixIndex !== -1) {
            // 寻找 app icon
            var appContentsPath = processMap[fields[1]].command.substring(0, suffixIndex + 13);

            try {
              // 最短 icns 文件并匹配 query 的路径
              var masterIconPath;
              // 最短 icns 文件路径
              var secondaryIconPath;

              traverseDirByLayer(appContentsPath, function(fileName, _path, stats, levelCount) {
                // 大于 10 层不找了
                if (levelCount > 10) {
                  return false;
                }
                var filePath = path.join(_path, fileName);

                if (fileName.indexOf('.icns') !== -1 && stats.isFile()) {
                  if (!secondaryIconPath || secondaryIconPath.length > filePath) {
                    secondaryIconPath = filePath;
                  }

                  if (fileName.indexOf(query) !== -1 && (!masterIconPath || masterIconPath.length > filePath)) {
                    masterIconPath = path.join(_path, fileName);
                  }
                }
              });

              item.icon = masterIconPath || secondaryIconPath || './86185AA6-ABD0-41DD-B98E-23A096E5310F.png';
              masterIconPath = secondaryIconPath = undefined;
            } catch (e) {
              // 某些特殊软件，例如钉钉，可能会因为乱码而找不到这个路径
            }
          }

          items.push(item);
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

// 逐层遍历文件夹
function traverseDirByLayer(filePath, handler) {
  // 错误路径
  if (!fs.existsSync(filePath)) {
    throw 'the path ' + filePath + ' is not exist.'
  }

  // 不是文件夹
  var stat = fs.statSync(filePath);

  if (!stat.isDirectory()) {
    throw 'the path ' + filePath + ' is not a directory.'
  }


  // 当前水平层级文件夹
  var dirs = [filePath];
  var tmpDirs = [];
  // 当前第几层
  var levelCount = 1;

  topLevel: for (var i = 0, length = dirs.length; i < length; i++) {
    var files = fs.readdirSync(dirs[i]);

    nextLevel: for (var j = 0, nextLevelLength = files.length; j < nextLevelLength; j++) {
      var fileName = files[j];
      var nextLevelFilePath = path.join(dirs[i], fileName);
      var stat = fs.statSync(nextLevelFilePath);
      var result = handler.call(fileName, fileName, dirs[i], stat, levelCount);

      if (typeof result === 'boolean' && !result) {
        // 退出遍历
        break topLevel;
      } else {
        if (stat.isDirectory()) {
          tmpDirs.push(nextLevelFilePath);
        }
      }
    }

    // 重置
    if (i === length - 1 && tmpDirs.length) {
      i = -1;
      dirs = tmpDirs;
      length = dirs.length;
      tmpDirs = [];
    }
    levelCount++;
  }
}
