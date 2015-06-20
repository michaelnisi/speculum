// speculum - transform concurrently

exports = module.exports = Speculum

var assert = require('assert')
var Readable = require('readable-stream').Readable
var util = require('util')

util.inherits(Speculum, Readable)
function Speculum (opts, reader, create, x) {
  if (!(this instanceof Speculum)) {
    return new Speculum(opts, reader, create, x)
  }
  Readable.call(this, opts)

  this.reader = reader
  this.create = create
  this.x = x || 5

  this.writers = []
  this.n = 0
  this.overflow = []
  this.started = false
}

Speculum.prototype._read = function (size) {
  var reader = this.reader
  var overflow = this.overflow
  while (overflow.length) {
    reader.unshift(overflow.shift())
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
    })
  }
  reader.resume()
}

Speculum.prototype.deinit = function () {
  this.reader = null
  this.create = null
  this.writers.forEach(function (writer) {
    delete writer.isWaiting
  })
  this.writers = null
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
    if (!ok) {
      writer.isWaiting = true
      me.once('drain', function () {
        ok = true
        writer.isWaiting = false
        me.reader.resume()
        read()
      })
    }
  }
  if (writers.length < this.x) {
    writer = this.create()
    assert(!('isWaiting' in writer), 'conflicting property name')
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
  var n = this.n
  var times = writers.length
  while (!writer && times--) {
    n = index(writers, n)
    writer = writers[n]
    if (writer.isWaiting || writer._writableState.needDrain) {
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
