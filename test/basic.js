var speculum = require('../')
var stream = require('stream')
var test = require('tap').test
var util = require('util')

test('constructor', function (t) {
  util.inherits(Reader, stream.Readable)
  function Reader () {
    stream.Readable.call(this)
    this.count = 0
  }
  Reader.prototype._read = function () {
    var ok = false
    do {
      ok = this.push(String(this.count++))
    } while (this.count < 100 && ok)
    if (this.count >= 100) {
      this.push(null)
    }
  }
  function create () {
    return new stream.PassThrough()
  }
  var f = speculum
  var opts = null
  var reader = new Reader()
  var s = f(opts, reader, create)
  t.plan(2)
  t.ok(s instanceof speculum.Speculum)
  s.on('end', function () {
    t.ok(true)
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
