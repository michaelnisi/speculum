var speculum = require('./')
var stream = require('readable-stream')
var test = require('tap').test
var util = require('util')

var MAX = 100

util.inherits(Count, stream.Readable)
function Count (opts, max) {
  stream.Readable.call(this, opts)
  this.count = 0
  this.max = max
}
Count.prototype._read = function () {
  var str = String(this.count++)
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
  var me = this
  setTimeout(function () {
    me.push(chunk)
    cb()
  }, Math.random() * 100)
}

test('basics', function (t) {
  function opts () {
    return { highWaterMark: Math.round(Math.random() * 16) }
  }
  function create () {
    return new Echo(opts())
  }
  var f = speculum
  var reader = new Count(opts(), MAX)
  var s = f(opts(), reader, create)
  t.plan(2)
  t.ok(s instanceof speculum.Speculum)
  var sum = 0
  s.on('data', function (chunk) {
    var n = parseInt(chunk, 10)
    sum += n
  })
  s.on('end', function () {
    var wanted = MAX * (MAX + 1) / 2
    t.is(sum, wanted)
  })
})

test('index', function (t) {
  var f = speculum.index
  var wanted = [
    0,
    0,
    1,
    0
  ]
  var found = [
    f([], 0),
    f([0], 0),
    f([0, 0], 0),
    f([0, 0], 1)
  ]
  t.plan(wanted.length)
  found.forEach(function (it) {
    t.same(it, wanted.shift())
  })
})
