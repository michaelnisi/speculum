var speculum = require('./')
var stream = require('stream')
var test = require('tap').test
var util = require('util')

test('basics', function (t) {
  util.inherits(Reader, stream.Readable)
  function Reader () {
    stream.Readable.call(this)
    this.count = 0
  }
  Reader.prototype._read = function () {
    var ok = false
    do {
      ok = this.push(String(this.count++))
    } while (this.count <= 100 && ok)
    if (this.count >= 100) {
      this.push(null)
    }
  }
  var opts = { encoding: 'utf8' }
  function create () {
    return new stream.PassThrough(opts)
  }
  var f = speculum
  var reader = new Reader(opts)
  var s = f(opts, reader, create)
  t.plan(2)
  t.ok(s instanceof speculum.Speculum)
  var chunks = 0
  s.on('data', function (chunk) {
    chunks += parseInt(chunk, 10)
  })
  s.on('end', function () {
    var wanted = 100 * (100 + 1) / 2
    t.is(chunks, wanted)
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
