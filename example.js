'use strict'

// example - measure one to ten concurrent streams

const assert = require('assert')
const speculum = require('./')
const stream = require('stream')
const util = require('util')

// A transform that does asynchronous work.
util.inherits(Echo, stream.Transform)
function Echo (opts) {
  if (!(this instanceof Echo)) {
    return new Echo(opts)
  }
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
  const s = speculum(null, Echo, x)
  s.on('end', cb)
  s.on('error', cb)

  const reader = new Count({ highWaterMark: 0 }, 10)

  reader.pipe(s).resume()
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

(function go (max, x = 1) {
  if (x > max) return
  measure(x, (er) => {
    assert(!er, er)
    go(max, x + 1)
  })
})(10)
