// speculum - stream concurrently

exports = module.exports = Speculum

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
  this.max = max || 16
}

Speculum.prototype._read = function (size) {
  this.push(null)
}

if (parseInt(process.env.NODE_TEST, 10) === 1) {
  exports.Speculum = Speculum
}
