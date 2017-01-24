'use strict'

const speculum = require('./')
const stream = require('readable-stream')
const test = require('tap').test
const util = require('util')

util.inherits(Count, stream.Readable)
function Count (opts, max) {
  stream.Readable.call(this, opts)
  this.count = 0
  this.max = max
}
Count.prototype._read = function () {
  const str = String(this.count++)
  this.push(new Buffer(str))
  if (this.count > this.max) {
    this.push(null)
  }
}

util.inherits(Echo, stream.Transform)
function Echo (opts) {
  stream.Transform.call(this, opts)
}
Echo.prototype._transform = function (chunk, enc, cb) {
  setTimeout(() => {
    this.push(chunk)
    cb()
  }, Math.random() * 100)
}

test('finishing without data', (t) => {
  const s = speculum(null, () => {}, 1)
  s.on('finish', () => { t.end() })
  s.end()
})

test('saturated writer', { skip: false }, (t) => {
  const s = speculum(null, () => {
    return new Echo({ highWaterMark: 0 })
  }, 1)
  t.ok(s instanceof speculum.Speculum)

  s.write('abc')
  s.write('def')

  let found = ''
  s.on('end', () => {
    t.is(found, 'abcdefghi')
    t.end()
  })

  setTimeout(() => {
    s.on('readable', () => {
      let chunk
      while ((chunk = s.read())) {
        found += chunk
      }
    })
    s.end('ghi')
  }, 300)
})

test('error emitting writer', { skip: false }, (t) => {
  const opts = { objectMode: true }
  const s = speculum(opts, () => {
    const writer = new stream.Transform(opts)
    writer._transform = function (chunk, enc, cb) {
      if (chunk === 'def') {
        return cb(new Error('not good'))
      }
      this.push(chunk)
      cb()
    }
    return writer
  }, 1)

  s.write('abc')

  t.plan(2)
  s.on('error', (er) => {
    t.pass('should emit error')
  })
  s.write('def')

  let found = ''
  s.on('end', () => {
    t.is(found, 'abcghi')
  })
  s.on('data', (chunk) => { found += chunk })
  s.end('ghi')
})

test('saturated self', { skip: false }, (t) => {
  const s = speculum({ highWaterMark: 0 }, () => {
    return new Echo()
  }, 1)
  t.ok(s instanceof speculum.Speculum)

  s.write('abc')
  s.write('def')

  let found = ''
  s.on('end', () => {
    t.is(found, 'abcdefghi')
    t.end()
  })

  setTimeout(() => {
    s.on('readable', () => {
      let chunk
      while ((chunk = s.read())) {
        found += chunk
      }
    })
    s.end('ghi')
  }, 300)
})

test('flowing mode', { skip: false }, (t) => {
  function check (hwm0, hwm1, x, cork, cb) {
    const max = 10

    const reader = new Count({ highWaterMark: 0 }, max)

    const s = speculum({ highWaterMark: hwm0, objectMode: true }, () => {
      return new Echo({ highWaterMark: hwm1 })
    }, x)
    t.ok(s instanceof speculum.Speculum)

    let sum = 0

    // Neither saturates nor drains the stream.
    if (cork) s.cork()

    s.on('data', (chunk) => {
      const n = parseInt(chunk, 10)
      sum += n
    })
    s.on('end', () => {
      const o = { hwm0, hwm1, x }
      const wanted = Object.assign({ sum: max * (max + 1) / 2 }, o)
      const found = Object.assign({ sum }, o)
      t.same(found, wanted)
      cb()
    })

    reader.pipe(s)

    if (hwm0 === 0) {
      process.nextTick(() => {
        s.uncork()
      })
    }
  }

  function go (checks) {
    const params = checks.shift()
    if (!params) return
    check.apply(null, params.concat([() => { go(checks) }]))
  }

  const checks = [
    [null, null, 1, true],
    [null, 4, 2, true],
    [null, 0, 5, true],
    [0, null, 4, true],
    [0, 0, 0, true],

    [null, null, 1, false],
    [null, 4, 2, false],
    [null, 0, 5, false],
    [0, null, 4, false],
    [0, 0, 0, false],

    [null, 0, 1, false] // Can’t saturate writer and 'drain' in flowing mode.
  ]

  t.plan(checks.length * 2)
  go(checks)
})
