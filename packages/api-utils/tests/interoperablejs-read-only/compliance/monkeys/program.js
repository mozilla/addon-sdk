var b = require('b');
var a = require('a');
var test = require('test');
test.assert(b.monkey != 10, 'monkeys not permitted on exports');
test.print('DONE', 'info');
