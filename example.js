'use strict'

// example - compare single stream with five concurrent streams

const assert = require('assert')
const speculum = require('./')
const stream = require('stream')
const util = require('util')

// A transform that does asynchronous work.
util.inherits(Echo, stream.Transform)
function Echo (opts) {
  stream.Transform.call(this, opts)
}
Echo.prototype._transform = function (chunk, enc, cb) {
  setTimeout(() => {
    this.push(chunk)
    cb()
  }, 100)
}

// An input stream to read from.
util.inherits(Count, stream.Readable)
function Count (opts, max) {
  stream.Readable.call(this, opts)
  this.count = 0
  this.max = max
}
Count.prototype._read = function () {
  let ok = false
  do {
    ok = this.push(String(this.count++))
  } while (this.count < this.max && ok)
  if (this.count >= this.max) {
    this.push(null)
  }
}

// Leverage x streams to transform, delayed echoing in this example, data from
// our readable stream.
function run (x, cb) {
  const opts = null
  const reader = new Count(opts, 10)
  const s = speculum(opts, reader, () => { return new Echo() }, x)
  s.on('end', cb)
  s.on('error', cb)
  s.resume()
}

function measure (x, cb) {
  function time (t) {
    return t[0] * 1e9 + t[1]
  }
  const t = process.hrtime()
  run(x, (er) => {
    const lat = time(process.hrtime(t))
    console.log(x + ' X took ' + (lat / 1e6).toFixed(2) + ' ms')
    cb(er)
  })
}

(function go (max, x) {
  x = x || 1
  if (x > max) return
  measure(x, (er) => {
    assert(!er)
    go(max, x * 3)
  })
})(9)
