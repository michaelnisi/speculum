// speculum - transform concurrently

exports = module.exports = Speculum

var assert = require('assert')
var Readable = require('readable-stream').Readable
var util = require('util')

function Speculum (opts, reader, create, x) {
  if (!(this instanceof Speculum)) {
    return new Speculum(opts, reader, create, x)
  }
  Readable.call(this, opts)

  this.reader = reader
  this.create = create
  this.x = x || 5

  this.n = 0
  this.overflow = []
  this.started = false
  this.waiting = new Set()
  this.writers = []
}
util.inherits(Speculum, Readable)

Speculum.prototype._read = function (size) {
  var reader = this.reader
  var overflow = this.overflow
  while (overflow.length) {
    var chunk = overflow.shift()
    reader.unshift(chunk)
    // As unshifting should be limited, make it observable.
    this.emit('unshift', chunk)
  }
  if (!this.started) {
    this.started = true
    var me = this
    reader.on('error', function (er) {
      me.emit('error', er)
    })
    reader.on('data', function (chunk) {
      var writer = me.next()
      if (writer) {
        if (!writer.write(chunk)) {
          writer.once('drain', function () {
            reader.resume()
          })
        }
      } else {
        me.overflow.push(chunk)
        reader.pause()
      }
    })
    reader.on('end', function () {
      reader.removeAllListeners()
      me.writers.forEach(function (writer) {
        var chunk = me.overflow.shift()
        writer.end(chunk)
      })
      me = null
      overflow = null
      reader = null
    })
  }
  reader.resume()
}

Speculum.prototype.deinit = function () {
  this.reader = null
  this.create = null
  this.writers = null
  this.waiting.clear()
  assert(this.overflow.length === 0, 'TODO: should be empty')
  this.overflow = null
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

Speculum.prototype.waits = function (writer) {
  return this.waiting.has(writer) || writer._writableState.needDrain
}

Speculum.prototype.next = function () {
  var me = this
  var writer
  var writers = this.writers
  var ok = true
  function read () {
    if (!ok) return
    var chunk
    while (ok && (chunk = writer.read()) !== null) {
      ok = me.push(chunk)
    }
    if (!ok) {
      me.waiting.set(writer)
      me.once('drain', function () {
        ok = true
        me.waiting.delete(writer)
        me.reader.resume()
        read()
      })
    }
  }
  if (writers.length < this.x) {
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
      me = null
      writer = null
      writers = null
    })
    writers.push(writer)
    return writer
  }
  var n = this.n
  var times = writers.length
  while (!writer && times--) {
    n = index(writers, n)
    writer = writers[n]
    if (this.waits(writer)) {
      writer = null
    }
  }
  if (writer) this.n = n
  return writer
}

if (parseInt(process.env.NODE_TEST, 10) === 1) {
  exports.Speculum = Speculum
  exports.index = index
}
