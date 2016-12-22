'use strict'

const speculum = require('./')
const stream = require('readable-stream')
const test = require('tap').test
const util = require('util')

const MAX = 100

util.inherits(Count, stream.Readable)
function Count (opts, max) {
  stream.Readable.call(this, opts)
  this.count = 0
  this.max = max
}
Count.prototype._read = function () {
  const str = String(this.count++)
  this.push(new Buffer(str))
  if (this.count > this.max) {
    this.push(null)
  }
}

util.inherits(Echo, stream.Transform)
function Echo (opts) {
  stream.Transform.call(this, opts)
}
Echo.prototype._transform = function (chunk, enc, cb) {
  setTimeout(() => {
    this.push(chunk)
    cb()
  }, Math.random() * 100)
}

test('basics', (t) => {
  function opts () {
    return { highWaterMark: Math.round(Math.random() * 16) }
  }
  function create () {
    return new Echo(opts())
  }
  const f = speculum
  const reader = new Count(opts(), MAX)
  const s = f(opts(), reader, create)
  t.plan(2)
  t.ok(s instanceof speculum.Speculum)
  let sum = 0
  s.on('data', (chunk) => {
    const n = parseInt(chunk, 10)
    sum += n
  })
  s.on('end', () => {
    const wanted = MAX * (MAX + 1) / 2
    t.is(sum, wanted)
  })
})

test('index', (t) => {
  const f = speculum.index
  const wanted = [
    0,
    0,
    1,
    0
  ]
  const found = [
    f([], 0),
    f([0], 0),
    f([0, 0], 0),
    f([0, 0], 1)
  ]
  t.plan(wanted.length)
  found.forEach((it) => {
    t.same(it, wanted.shift())
  })
})
