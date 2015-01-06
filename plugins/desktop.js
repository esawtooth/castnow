var http = require('http');
var internalIp = require('internal-ip');
var router = require('router');
var path = require('path');
var serveMp4 = require('../utils/serve-mp4');
var debug = require('debug')('castnow:localfile');
var fs = require('fs');
var port = 4100;

var isFile = function(item) {
  return item.path.indexOf('desktop') > -1;
};

var contains = function(arr, cb) {
  for (var i=0, len=arr.length; i<len; i++) {
    if (cb(arr[i], i)) return true;
  }
  return false;
};

var desktop = function(ctx, next) {
  if (ctx.mode !== 'launch') return next();
  if (!contains(ctx.options.playlist, isFile)) return next();
  if (ctx.options.playlist.length > 1) return next();
  console.log("Trying to cast screen");

  var route = router();
  var list = ctx.options.playlist.slice(0);
  var ip = (ctx.options.myip || internalIp());

  ctx.options.playlist = list.map(function(item, idx) {
    if (!isFile(item)) return item;
    return {
      path: 'http://' + ip + ':' + port + '/' + idx,
      type: 'video/mp4',
      media: {
        metadata: {
          title: path.basename(item.path)
        }
      }
    };
  });

  route.all('/{idx}', function(req, res) {
    debug('incoming request serving %s', list[req.params.idx].path);
    serveMp4(req, res, "/tmp/screen.mp4");
  });

  http.createServer(route).listen(port);
  debug('started webserver on address %s using port %s', ip, port);
  next();
};

module.exports = desktop;
