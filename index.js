'use strict'

// speculum - transform concurrently

exports = module.exports = Speculum

const debug = require('util').debuglog('speculum')
const stream = require('readable-stream')
const util = require('util')

function Speculum (opts, create, x = 1) {
  if (typeof x !== 'number') throw new Error('multiplier must be number')
  x = Math.max(x, 1)
  if (!(this instanceof Speculum)) {
    return new Speculum(opts, create, x)
  }
  stream.Transform.call(this, opts)

  this.create = create
  this.x = x

  this.writers = []
  this.busy = new Set()
}

util.inherits(Speculum, stream.Transform)

Speculum.prototype.createWriter = function () {
  const writer = this.create()

  let ok = true
  const write = () => {
    let chunk
    while (ok && (chunk = writer.read()) !== null) {
      ok = this.push(chunk)
    }
    if (!ok) {
      this.once('drain', () => {
        ok = true
        write()
      })
    }
  }
  writer.on('readable', write)

  // TODO: Consider replacing the troubled writer with a new instance

  writer.on('error', (er) => {
    this.emit('error', er)
  })

  return writer
}

Speculum.prototype.rotate = function () {
  const writer = this.writers.shift()
  this.writers.push(writer)
  return writer
}

Speculum.prototype.next = function () {
  if (this.writers.length < this.x) {
    const writer = this.createWriter()
    this.writers.push(writer)
    return writer
  }
  if (this.writers.length === 1) {
    return this.writers[0]
  }
  let i = this.writers.length
  while (i--) {
    const writer = this.rotate()
    if (!this.busy.has(writer)) {
      return writer
    }
  }
  return this.rotate()
}

Speculum.prototype._transform = function (chunk, enc, cb) {
  const writer = this.next()
  let ok = writer.write(chunk)
  if (!ok) {
    debug('saturated writer')
    if (!this.busy.has(writer)) {
      this.busy.add(writer)
      writer.once('drain', () => {
        this.busy.delete(writer)
      })
    }
  }
  cb()
}

Speculum.prototype._flush = function (cb) {
  debug('_flush: %s', this.writers.length)
  this.writers.forEach(writer => {
    writer.on('finish', () => {
      writer.removeAllListeners() // assuming we own these
      this.writers = this.writers.filter(w => { return w !== writer })
      if (this.writers.length === 0) {
        this.writers = null
        this.create = null
        this.busy.clear()
        this.busy = null
        return cb()
      }
    })
    writer.end()
  })
}

if (process.mainModule.filename.match(/test/) !== null) {
  exports.Speculum = Speculum
}
