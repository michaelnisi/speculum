// example - compare single stream with five concurrent streams

var speculum = require('./')
var stream = require('stream')
var util = require('util')

util.inherits(Echo, stream.Transform)
function Echo (opts) {
  stream.Transform.call(this, opts)
}
Echo.prototype._transform = function (chunk, enc, cb) {
  var me = this
  setTimeout(function () {
    me.push(chunk)
    cb()
  }, 100)
}

util.inherits(Count, stream.Readable)
function Count (opts, max) {
  stream.Readable.call(this, opts)
  this.count = 0
  this.max = max
}
Count.prototype._read = function () {
  var ok = false
  do {
    ok = this.push(String(this.count++))
  } while (this.count < this.max && ok)
  if (this.count >= this.max) {
    this.push(null)
  }
}

function run (x, cb) {
  var opts = null
  var reader = new Count(opts, 10)
  function create () {
    return new Echo()
  }
  var s = speculum(opts, reader, create, x)
  s.on('end', cb)
  s.on('error', cb)
  s.resume()
}

function measure (x, cb) {
  function time (t) {
    return t[0] * 1e9 + t[1]
  }
  var t = process.hrtime()
  run(x, function (er) {
    var lat = time(process.hrtime(t))
    console.log(x + ' X took ' + (lat / 1e6).toFixed(2) + ' ms')
    cb(er)
  })
}

measure(1, function (er) {
  measure(5, function (er) {})
})
