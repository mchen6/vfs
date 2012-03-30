var http = require('http');
var urlParse = require('url').parse;

var vfs = require('./localfs')({
  root: "/home/tim/architect/demos/editor/www/",
  uid: 1000,
  gid: 100
});

http.createServer(function (req, res) {

  function abort(err, code) {
    if (code) res.statusCode = code;
    else if (err.code === "ENOENT") res.statusCode = 404;
    else if (err.code === "EACCESS") res.statucCode = 403;
    else res.statusCode = 500;
    message = (err.stack || err) + "\n";
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Content-Length", Buffer.byteLength(message));
    res.end(message);
  }

  var options = {};
  if (req.method === "HEAD") {
    options.head = true;
    req.method = "GET";
  }

  var path = urlParse(req.url).pathname;
  
  if (req.method === "GET") {

    if (req.headers.hasOwnProperty("if-none-match")) options.etag = req.headers["if-none-match"];
    
    if (path[path.length - 1] === "/") { // directory serve
      
      vfs.readdir(path, options, onGet);
    
    } // end directory serve
    else { // file serve

      if (req.headers.hasOwnProperty('range')) {
        var range = options.range = {};
        var p = req.headers.range.indexOf('=');
        var parts = req.headers.range.substr(p + 1).split('-');
        if (parts[0].length) {
          range.start = parseInt(parts[0], 10);
        }
        if (parts[1].length) {
          range.end = parseInt(parts[1], 10);
        }
        if (req.headers.hasOwnProperty('if-range')) range.etag = req.headers["if-range"];
      }
      
      vfs.createReadStream(path, options, onGet);

    } // end file serve

    function onGet(err, meta) {
      res.setHeader("Date", (new Date()).toUTCString());
      if (err) return abort(err);
      if (meta.rangeNotSatisfiable) return abort(meta.rangeNotSatisfiable, 416);
      
      if (meta.hasOwnProperty('etag')) res.setHeader("ETag", meta.etag);

      if (meta.notModified) res.statusCode = 304;
      if (meta.partialContent) res.statusCode = 206;

      if (meta.hasOwnProperty('stream') || options.head) {
        if (meta.hasOwnProperty('mime')) res.setHeader("Content-Type", meta.mime);
        if (meta.hasOwnProperty("size")) {
          res.setHeader("Content-Length", meta.size);
          if (meta.hasOwnProperty("partialContent")) {
            res.setHeader("Content-Range", "bytes " + meta.partialContent.start + "-" + meta.partialContent.end + "/" + meta.partialContent.size);
          }
        }
      }
      if (meta.hasOwnProperty('stream')) {
        meta.stream.on("error", abort);
        meta.stream.pipe(res);
      } else {
        res.end();
      }
    }

  } // end GET request
  else {
    return abort("Unsupported HTTP method", 501);
  }
  
}).listen(9000, function () {
  console.log("Server listening at http://localhost:9000/");
});
