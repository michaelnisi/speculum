'use strict'

// speculum - transform concurrently

exports = module.exports = Speculum

const assert = require('assert')
const Readable = require('readable-stream').Readable
const util = require('util')

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
  let reader = this.reader
  let overflow = this.overflow
  while (overflow.length) {
    const chunk = overflow.shift()
    reader.unshift(chunk)
    // As unshifting should be limited, make it observable.
    this.emit('unshift', chunk)
  }
  if (!this.started) {
    this.started = true
    reader.on('error', (er) => {
      this.emit('error', er)
    })
    reader.on('data', (chunk) => {
      const writer = this.next()
      if (writer) {
        if (!writer.write(chunk)) {
          writer.once('drain', () => {
            reader.resume()
          })
        }
      } else {
        this.overflow.push(chunk)
        reader.pause()
      }
    })
    reader.on('end', () => {
      reader.removeAllListeners()
      this.writers.forEach((writer) => {
        const chunk = this.overflow.shift()
        writer.end(chunk)
      })
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
  let writer = null
  let writers = this.writers
  let ok = true
  const read = () => {
    if (!ok) return
    let chunk = null
    while (ok && (chunk = writer.read()) !== null) {
      ok = this.push(chunk)
    }
    if (!ok) {
      this.waiting.set(writer)
      this.once('drain', () => {
        ok = true
        this.waiting.delete(writer)
        this.reader.resume()
        read()
      })
    }
  }
  if (writers.length < this.x) {
    writer = this.create()
    writer.on('error', (er) => {
      this.emit('error', er)
    })
    writer.on('readable', read)
    writer.on('end', () => {
      writer.removeAllListeners()
      if (!this._readableState.ended && ended(writers)) {
        this.push(null)
        this.deinit()
      }
      writer = null
      writers = null
    })
    writers.push(writer)
    return writer
  }
  let n = this.n
  let times = writers.length
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

if (process.mainModule.filename.match(/test/) !== null) {
  exports.Speculum = Speculum
  exports.index = index
}
