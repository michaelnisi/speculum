# speculum - transform concurrently

The **speculum** [Node](http://nodejs.org/) package provides a [Readable](https://nodejs.org/api/stream.html#stream_class_stream_readable) stream which combines a readable input stream and a configurable number of [Transform](https://nodejs.org/api/stream.html#stream_class_stream_transform) stream instances to concurrently transform data from a single source. If result order is not paramount, **speculum** can reduce run time.

[![Build Status](https://secure.travis-ci.org/michaelnisi/speculum.svg)](http://travis-ci.org/michaelnisi/speculum)

A sequential stream's run time *T* grows linearly with the number *N* of chunks (units of work in this case) *C*:

*T = N * C*

**speculum** divides the time spent by the number of concurrent streams *X*:

*T = N * C / X*

## Example

Here is a somewhat contrived, but runnable, example comparing the run time of a single stream with five concurrent streams:

```js
var speculum = require('speculum')
var stream = require('stream')
var util = require('util')

util.inherits(Echo, stream.Transform)
function Echo (opts) {
  stream.Transform.call(this, opts)
}
Echo.prototype._transform = function (chunk, enc, cb) {
  var me = this
  setTimeout(function () {
    me.push(chunk)
    cb()
  }, 100)
}

util.inherits(Count, stream.Readable)
function Count (opts, max) {
  stream.Readable.call(this, opts)
  this.count = 0
  this.max = max
}
Count.prototype._read = function () {
  var ok = false
  do {
    ok = this.push(String(this.count++))
  } while (this.count < this.max && ok)
  if (this.count >= this.max) {
    this.push(null)
  }
}

function run (x, cb) {
  var opts = null
  var reader = new Count(opts, 10)
  function create () {
    return new Echo()
  }
  var s = speculum(opts, reader, create, x)
  s.on('end', cb)
  s.on('error', cb)
  s.resume()
}

function measure (x, cb) {
  function time (t) {
    return t[0] * 1e9 + t[1]
  }
  var t = process.hrtime()
  run(x, function (er) {
    var lat = time(process.hrtime(t))
    console.log(x + ' X took ' + (lat / 1e6).toFixed(2) + ' ms')
    cb(er)
  })
}

measure(1, function (er) {
  measure(5, function (er) {})
})
```

Run it with:

```
$ node example.js
```

## exports

### speculum(opts, reader, create, x)

- `opts` `Object | null` Options passed to this stream constructor
- `reader` `stream.Readable` The input stream
- `create` `Function` Factory function to create transform streams
- `x` `Number | 5` The number of concurrent transform streams to use

The **speculum** module exports a function that returns an instance of the `Speculum` class which extends `stream.Readable`. To access the Speculum class `require('speculum')`. The **speculum** stream round-robins the transform instances while avoiding to overflow its own and the transformers' buffers.

## Installation

With [npm](https://npmjs.org/package/speculum) do:

```
$ npm install speculum
```

## License

[MIT License](https://raw.github.com/michaelnisi/speculum/master/LICENSE)
