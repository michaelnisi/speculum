[![Build Status](https://secure.travis-ci.org/michaelnisi/speculum.svg)](http://travis-ci.org/michaelnisi/speculum)
[![Coverage Status](https://coveralls.io/repos/github/michaelnisi/speculum/badge.svg)](https://coveralls.io/github/michaelnisi/speculum)

# speculum - transform concurrently

The **speculum** [Node](http://nodejs.org/) package provides a [Readable](https://nodejs.org/api/stream.html#stream_class_stream_readable) stream that combines a readable input stream and a configurable number of [Transform](https://nodejs.org/api/stream.html#stream_class_stream_transform) stream instances to concurrently transform data from a single source (the input stream). In use cases where result order is not paramount, **speculum** can reduce run time.

An IO-heavy transform stream’s run time *T* grows linearly with the number *N* of chunks (units of IO work) *C*:

*T = N * C*

**speculum** divides the run time by the number of concurrent streams *X*:

*T = N * C / X*

## Example

Here is a, somewhat contrived but runnable, example comparing the run time of a single stream with five concurrent streams:

```js
const assert = require('assert')
const speculum = require('speculum')
const stream = require('stream')
const util = require('util')

// A transform that does asynchronous work.
util.inherits(Echo, stream.Transform)
function Echo (opts) {
  stream.Transform.call(this, opts)
}
Echo.prototype._transform = function (chunk, enc, cb) {
  setTimeout(() => {
    this.push(chunk)
    cb()
  }, 100)
}

// An input stream to read from.
util.inherits(Count, stream.Readable)
function Count (opts, max) {
  stream.Readable.call(this, opts)
  this.count = 0
  this.max = max
}
Count.prototype._read = function () {
  let ok = false
  do {
    ok = this.push(String(this.count++))
  } while (this.count < this.max && ok)
  if (this.count >= this.max) {
    this.push(null)
  }
}

// Leverage x streams to transform, delayed echoing in this example, data from
// our readable stream.
function run (x, cb) {
  const opts = null
  const reader = new Count(opts, 10)
  const s = speculum(opts, reader, () => { return new Echo() }, x)
  s.on('end', cb)
  s.on('error', cb)
  s.resume()
}

function measure (x, cb) {
  function time (t) {
    return t[0] * 1e9 + t[1]
  }
  const t = process.hrtime()
  run(x, (er) => {
    const lat = time(process.hrtime(t))
    console.log(x + ' X took ' + (lat / 1e6).toFixed(2) + ' ms')
    cb(er)
  })
}

(function go (max, x) {
  x = x || 1
  if (x > max) return
  measure(x, (er) => {
    assert(!er)
    go(max, x * 3)
  })
})(9)
```

You can this with:

```
$ node example.js
```

## exports

### speculum(opts, reader, create, x)

- `opts` `Object | null` Options passed to this stream constructor.
- `reader` `stream.Readable` The input stream.
- `create` `Function` Factory function to create transform streams.
- `x` `Number | 5` The number of concurrent transform streams to use.

The **speculum** module exports a function that returns an instance of the `Speculum` class which extends `stream.Readable`. To access the Speculum class `require('speculum')`. The **speculum** stream round-robins the transform instances while avoiding to overflow its own and the transformers’ buffers.

## Installation

With [npm](https://npmjs.org/package/speculum), do:

```
$ npm install speculum
```

## License

[MIT License](https://raw.github.com/michaelnisi/speculum/master/LICENSE)
