'use strict';

exports['test if stack contains `Iterator`'] = function(test) {
  let stack,
      fixture = {
        get __iterator__() {
          stack = Error().stack
          return function() { yield 1; }
        }
      }

  for each (let foo in Iterator(fixture)) foo;

  test.assert(
    0 <= stack.indexOf('Iterator'),
    'Error stack must contain `Iterator`:\n' + stack
  );
}

