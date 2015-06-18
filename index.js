// speculum - transform concurrently

exports = module.exports = Speculum

var assert = require('assert')
var Readable = require('stream').Readable
var util = require('util')

util.inherits(Speculum, Readable)
function Speculum (opts, reader, create, max) {
  if (!(this instanceof Speculum)) {
    return new Speculum(opts, reader, create, max)
  }
  Readable.call(this, opts)

  this.reader = reader
  this.create = create
  this.max = max || 5

  this.writers = []
  this.n = 0
  this.buf = []

  var me = this
  reader.on('error', function (er) {
    me.emit('error', er)
  })
  reader.on('data', function (chunk) {
    assert(chunk !== null)
    var writer = me.next()
    if (writer) {
      writer.write(chunk)
    } else {
      me.buf.push(chunk)
    }
  })
  reader.on('end', function () {
    reader.removeAllListeners()
    me.writers.forEach(function (writer) {
      writer.end()
    })
  })
  reader.pause()
}

Speculum.prototype._read = function (size) {
  this.reader.resume()
}

Speculum.prototype.deinit = function () {
  this.reader = null
  this.create = null
  this.writers.forEach(function (writer) {
    delete writer.isWaiting
  })
  this.writers = null
  assert(this.buf.length === 0, 'should be empty')
  this.buf = null
}

function index (arr, n) {
  if (++n >= arr.length) n = 0
  return n
}

function ended (writers) {
  return !writers.some(function (writer) {
    return !writer._readableState.ended
  })
}

Speculum.prototype.next = function () {
  var me = this
  var writer
  var writers = this.writers
  var ok = true
  function read () {
    if (!ok) return
    var chunk
    while ((chunk = writer.read()) !== null) {
      ok = me.push(chunk)
    }
    if (ok === false) {
      writer.isWaiting = !ok
      me.once('drain', function () {
        ok = true
        writer.isWaiting = !ok
        read()
      })
    }
  }
  if (writers.length < this.max) {
    writer = this.create()
    writer.on('error', function (er) {
      me.emit('error', er)
    })
    writer.on('readable', read)
    writer.on('end', function () {
      writer.removeAllListeners()
      if (!me._readableState.ended && ended(writers)) {
        me.push(null)
        me.deinit()
      }
    })
    writers.push(writer)
    return writer
  }
  this.n = index(writers, this.n)
  writer = writers[this.n]
  if (writer.isWaiting) {
    console.log('TODO: Handle waiting writers')
    return null
  }
  return writer
}

if (parseInt(process.env.NODE_TEST, 10) === 1) {
  exports.Speculum = Speculum
  exports.index = index
}
