var http = require('http');
var internalIp = require('internal-ip');
var router = require('router');
var path = require('path');
var serveMp4 = require('../utils/serve-mp4');
var debug = require('debug')('castnow:localfile');
var ffmpeg = require('fluent-ffmpeg');
var fs = require('fs');
var port = 14100;
require("shelljs/global");
var child_process = require("child_process")

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


  // Get the video stream in place. Only for mac
  var vlc_path = "/Applications/VLC.app/Contents/MacOS/VLC";
  var fps = "20";
  var inres = "1440x900";
  var inres = "1440x900";
  var outres = "1280x720";
  var coreaudio_device = "Soundflower (2ch)";
  var vlc_video_fifo = "/tmp/vlc-ffmpeg.raw";
  var audio_fifo = "/tmp/sox-ffmpeg.wav";

  // recreate the fifos
  exec("rm -f " + vlc_video_fifo);
  exec("rm -f " + audio_fifo);
  exec("mkfifo " + vlc_video_fifo);
  exec("mkfifo " + audio_fifo);

  console.log("Refreshed fifos");

  //exec('sox --buffer 4194304 -q -c 2 -t coreaudio "' + coreaudio_device + '" -t wav ' + audio_fifo + ' &', {async:true});
  //console.log("Launched sox");
  exec(vlc_path + ' screen:// :screen-fps="' + fps + '" -I dummy --sout "file/dummy:"' + vlc_video_fifo + ' &', {async:true});
  console.log("Launched vlc");

  // spawn ffmpeg and pipe to res

  var ffmpeg = child_process.spawn("/Users/rohit.jain/Personal/src/github/ffmpeg/ffmpeg", [
    '-threads', "0" ,
    '-f', 'rawvideo', 
    '-pix_fmt', 'bgra',
    '-s', inres,
    '-r', fps,
    '-i', vlc_video_fifo,
    '-vcodec', 'libx264',
    '-s', outres,
    '-pix_fmt', 'yuv420p',
    '-movflags', 'faststart',
    '-f', 'matroska',
    'pipe:1' // Output on stdout
  ]);


//  var ffmpeg1 = child_process.spawn("/Users/rohit.jain/Personal/src/github/ffmpeg/ffmpeg", [
//    '-f', 'avfoundation', 
//    '-list_devices', 'true',
//    '-i', '""'
//  ]);


  console.log("spawned ffmpeg");

  ffmpeg.stderr.on('data', function (data) {
              console.log('stderr: ' + data);
              });
  //ffmpeg.stdout.on('data', function (data) {
  //            console.log('stdout: ' + data);
  //            });
          

  //setTimeout(function() {
  //}, 1000);

  route.all('/{idx}', function(req, res) {
    debug('incoming request serving %s', list[req.params.idx].path);
    res.setHeader('Content-Type', "video/x-matroska");
    res.setHeader('Access-Control-Allow-Origin', '*');
    //res.setHeader('Content-Length', 100000000000);
    res.statusCode = 200;
    //exec("cat " + vlc_video_fifo + " &> /dev/null");
    //console.log("Cleared buffer");
    return ffmpeg.stdout.pipe(res);
  });

  http.createServer(route).listen(port);
  debug('started webserver on address %s using port %s', ip, port);
  next();
};

module.exports = desktop;
