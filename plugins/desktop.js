var http = require('http');
var internalIp = require('internal-ip');
var router = require('router');
var path = require('path');
var serveMp4 = require('../utils/serve-mp4');
var debug = require('debug')('castnow:localfile');
var ffmpeg = require('fluent-ffmpeg');
var fs = require('fs');
var port = 14100;

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

//  var command = ffmpeg(fs.createReadStream('/tmp/final-video.mp4'));


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
    res.setHeader('Content-Type', "video/x-matroska");
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Length', 100000000000);
    res.statusCode = 200;
    return fs.createReadStream("/tmp/out.mkv").pipe(res);
  });

  http.createServer(route).listen(port);
  debug('started webserver on address %s using port %s', ip, port);
  next();
};

module.exports = desktop;
