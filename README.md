[![Build Status](https://secure.travis-ci.org/michaelnisi/speculum.svg)](http://travis-ci.org/michaelnisi/speculum)
[![Coverage Status](https://coveralls.io/repos/github/michaelnisi/speculum/badge.svg)](https://coveralls.io/github/michaelnisi/speculum)

# speculum - transform concurrently

The **speculum** [Node](http://nodejs.org/) package provides a [Transform](https://nodejs.org/api/stream.html#stream_class_stream_readable) stream that combines a readable input stream and a configurable number of [Transform](https://nodejs.org/api/stream.html#stream_class_stream_transform) stream instances to concurrently transform data from a single source (the input stream). In use cases where result order is not paramount, **speculum** can reduce run time.

An IO-heavy transform stream’s run time *T* grows linearly with the number *N* of chunks (units of IO work) *C*:

*T = N * C*

**speculum** divides the run time by the number of concurrent streams *X*:

*T = N * C / X*

—in theory.

## Example

Here is a, somewhat contrived but runnable, example comparing the run time of a single stream with five concurrent streams:

```js
'use strict'

// example - measure one to ten concurrent streams

const assert = require('assert')
const speculum = require('./')
const stream = require('stream')
const util = require('util')

// A transform that does asynchronous work.
util.inherits(Echo, stream.Transform)
function Echo (opts) {
  if (!(this instanceof Echo)) {
    return new Echo(opts)
  }
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
  const s = speculum(null, Echo, x)
  s.on('end', cb)
  s.on('error', cb)

  const reader = new Count({ highWaterMark: 0 }, 10)

  reader.pipe(s).resume()
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

(function go (max, x = 1) {
  if (x > max) return
  measure(x, (er) => {
    assert(!er, er)
    go(max, x + 1)
  })
})(10)
```

You can run this with:

```
$ node example.js
```

On this MacBook Air (11-inch, Mid 2011), with Node v6.7.0, I get:

```
1 X took 1088.49 ms
2 X took 525.67 ms
3 X took 411.52 ms
4 X took 317.99 ms
5 X took 210.97 ms
6 X took 210.99 ms
7 X took 210.68 ms
8 X took 210.24 ms
9 X took 211.61 ms
10 X took 104.25 ms
```

Clearly, we have to balance workload and overhead to use this efficiently.

## exports

### speculum(opts, create, x = 1)

- `opts` `Object() | null | undefined` Options passed to the stream constructor.
- `create` `function` A constructor function applied to create transform streams.
- `x` `Number() | null | undefined` The number of concurrent transform streams defaults to one.

The **speculum** module exports a function that returns an instance of the `Speculum` class which extends `stream.Transform`. To access the `Speculum` class `require('speculum')`. The **speculum** stream round-robins transformers and exposes their buffers and errors through its `stream.Readable` interface.

## Installation

With [npm](https://npmjs.org/package/speculum), do:

```
$ npm install speculum
```

## License

[MIT License](https://raw.github.com/michaelnisi/speculum/master/LICENSE)
