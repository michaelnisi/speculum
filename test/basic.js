var test = require('tap').test
var speculum = require('../')

test('constructor', function (t) {
  var f = speculum
  t.ok(f() instanceof speculum.Speculum)
  t.end()
})
