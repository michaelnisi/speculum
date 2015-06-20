var speculum = require('./')
var stream = require('readable-stream')
var test = require('tap').test
var util = require('util')

util.inherits(Count, stream.Readable)
function Count () {
  stream.Readable.call(this)
  this.count = 0
}
Count.prototype._read = function () {
  var ok = false
  do {
    ok = this.push(String(this.count++))
  } while (this.count <= 100 && ok)
  if (this.count >= 100) {
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
  var opts = { encoding: 'utf8', highWaterMark: 0 }
  function create () {
    return new Echo(opts)
  }
  var f = speculum
  var reader = new Count(opts)
  var s = f(opts, reader, create)
  t.plan(2)
  t.ok(s instanceof speculum.Speculum)
  var sum = 0
  s.on('data', function (chunk) {
    var n = parseInt(chunk, 10)
    sum += n
  })
  s.on('end', function () {
    var wanted = 100 * (100 + 1) / 2
    t.is(sum, wanted)
  })
  s.resume()
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
