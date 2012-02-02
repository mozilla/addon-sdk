## Rationale

Most of the JS APIs are asynchronous complementing it's non-blocking nature.
While this is has a good reason and many advantages, it comes with a price.
Instead of structuring our programs into logical black boxes:

    function blackbox(a, b) {
      var c = assemble(a);
      return combine(b, c);
    }


We're forced into continuation passing style, involving lot's of machinery:

    function sphagetti(a, b, callback) {
      assemble(a, function continueWith(error, c) {
        if (error) callback(error);
        else combine(b, c, callback);
      });
    }

This style also makes doing things in sequence hard:

    widget.on('click', function onClick() {
      promptUserForTwitterHandle(function continueWith(error, handle) {
        if (error) return ui.displayError(error);
        twitter.getTweetsFor(handle, funtion continueWith(error, tweets) {
          if (error) return ui.displayError(error);
          ui.showTweets(tweets);
        });
      });
    });

Doing things in parallel is even harder:

    var tweets, answers, checkins;
    twitter.getTweetsFor(user, function continueWith(result) {
      tweets = result;
      somethingFinished();
    });

    stackOverflow.getAnswersFor(question, function continueWith(result) {
      answers = result;
      somethingFinished();
    });

    fourSquare.getCheckinsBy(user, function continueWith(result) {
      checkins=result;
      somethingFinished();
    }); 

    var finished = 0;
    functions omethingFinished() {
      if (++finished === 3)
        ui.show(tweets, answers, checkins);
    }

This also makes error handling quite of an adventure.

## Promises

Consider another approach, where instead of continuation passing via `callback`
functions return an object that represents the eventual result of the function,
either successful or failed. This object is a promise, both figuratively and by
name, to eventually resolve. We can call a function on the promise to observe
either its fulfillment or rejection. If the promise is rejected and the
rejection is not explicitly observed, any derived promises will be implicitly
rejected for the same reason.

In the Add-on SDK we follow a [CommonJS Promises/A]
(http://wiki.commonjs.org/wiki/Promises/A) specification and model a promise as
an object with a `then` method, which can be used to get the eventual return
(fulfillment) value or thrown exception (rejection):

    foo().then(function success(value) {

    }, function failure(reason) {

    });

If `foo` returns a promise that gets fulfilled later with a return value,
`success` callback (the value handler) will be called with the value. However,
if the returned function gets rejected later by a thrown exception, the
`failure` callback (the error handler) will be called with the error.

## Propagation

The `then` method of a promise returns a new promise that is fulfilled with the
return value of either handler. Since function con either return value or throw
an exception, only one handler will be ever called.


    var bar = foo().then(function success(value) {
    }, function failure(reason) {
    });

In this example `bar` is a promise and it's fulfilled by one of two handlers
that are responsible for.

  - If handler returns a value, `bar` will get fulfilled with it.
  - If handler throws an exception, `bar` will get rejected with it.
  - If handler returns a **promise**, `bar` will "become" that promise. To be
    more precise it will be fulfilled with a resolution value of the returned
    promise, which will make it behave as if it was that returned promise.

if the `foo()` promise gets rejected and you omit the `error` handler, the
**error** propagate to `bar`:

If the `foo()` promise gets fulfilled and you omit the value handler, the value
will propagate to `bar`:

    var bar = foo().then(function success(value) {
    });

If the `foo()` promise gets fulfilled and you omit the value handler, value
will propagate to `bar`:

    var bar = foo().then(null, function failure(error) {
    });


## Chaining

There are two ways to chain promises. You can chain promises either inside or
outside handlers. The next two examples are equivalent:

    foo().then(function (fooValue) {
      return bar(fooValue).then(function (barValue) {
        // if we get here without an error,
        // the value retuned here
        // or the exception thrown here
        // resolves the promise returned
        // by the first line
      });
    });

    foo().then(function (fooValue) {
      return bar(fooValue);
    }).then(function (barValue) {
      // if we get here without an error,
      // the value retuned here
      // or the exception thrown here
      // resolves the promise returned
      // by the first line
    })

The only difference is nesting. It's useful to nest handlers if you need to
capture both `fooValue` and `barValue` in the last handler:

    function eventualAdd(a, b) {
      return a.then(function (a) {
        return b.then(function (b) {
          return a + b;
        });
      });
    }

## Error handling

One sometimes-unintuitive aspect of promises is that if you throw an exception
in the value handler, it will not be be caught by the error handler.

    foo().then(function (value) {
      throw new Error("Can't bar.");
    }, function (error) {
      // We only get here if "foo" fails
    });

To see why this is, consider the parallel between promises and `try`/`catch`.
We are `try`-ing to execute `foo()`: the error handler represents a `catch`
for `foo()`, while the value handler represents code that happens *after* the 
`try`/`catch` block. That code then needs its own `try`/`catch` block.

In terms of promises, this means chaining your error handler:

    foo().then(function (value) {
      throw new Error("Can't bar.");
    }).then(null, function(error) {
      // We get here with either foo's error or bar's error
    })

# API

Everything above assumes you get a promise from somewhere else. This
is the common case. Every once in a while, you will need to create a
promise from scratch. Add-on SDK's `promise` module provides API for doing
this.

## promise

Module provides a simple function for wrapping values into promises:

    const { promise } = require('api-utils/promise');

    var a = promise(5).then(function(value) {
      value + 2
    });
    var b = promise(a);
    b.then(console.log);  // => 7

## future

If you have a `taks` that you can call which either returns `value` / `promise`
or throws you can create a promise out of it.

    const { future } = require('api-utils/promise');

    let promise = future(function task() {
      // perform your task here
    });
    result.then(function success() {
      // handle value
    }, function failure() {
      // handle error
    });

If you have a `task` that preforms some computation on a given `value` and a
promise for that `value` then `future` is even more helpful:

    let result = future(function task(value) {
      // note that `value` is not a promise but an actual value.
      return promise + 10
    }, promise)

**Note** that second argument to a `future` may be either value or a promise.

## future.lazy

Sometimes you might want to create a promise with a future but delay actual
computation until it's actually necessary. This can be done using
a `future.lazy` function that has exact same API as `future` with a difference
that `task` will be only invoked once first handler on returned promise is
registered.

## defer

When nothing else will do the job, you can use `defer`, which is where all
promises ultimately come from:

    const { defer } = require('api-utils/promise');

    function delay(ms) {
      let { promise, resolve } = defer();
      setTimeout(resolve, ms);
      return promise;
    }

    function timeout(promise, ms) {
      let { promise, resolve, reject } = defer();
      promise.then(resolve, reject);
      delay(ms).then(rejecet);
      return promise;
    }

So `defer` returns an object that contains `promise` and two `resolve`, `reject`
functions that can be used to resolve / reject that `promise`. **Note:** that
promise can be rejected / resolved only once all subsequent attempts will be
ignored.

There may be a cases where you will want to provide more than just `then` method
on your promise. Such cases are also supported by `defer` as it uses given
argument as prototype for the returned promise and all the subsequent promises:

    let { promise, resolve } = defer({
      get: function get(name) {
        return this.then(function() {
          return this[name];
        })
      }
    });

    promise.get('foo').get('bar').then(consol.log);
    resolve({ foo: { bar: 'taram !!' } });

    // => 'taram !!'

## failure

Now we that we can create all kinds of eventual values, it's useful to have a
way to create eventual exceptions. Module exports `failure` exactly for that.
It takes anything as an argument and returns a promise that is rejected with
it.

    const { failure } = require('api-utils/promise');

    var boom = failure(Error('boom!'));

    future(function() {
      return Math.random() < 0.5 ? boom : value
    })

## isPromise

Even though it's not very common to test values weather they are promises or
not (specially since they can be just wrapped by `promise` and be used as such)
there may be a case once in a while. There for module exports `isPromise`
function to do that. **Note**: that any object implementing `then` method is
assumed to be a promise.

      const { isPromise } = require('api-utils/promise');

      isPromise(5)            // => false
      isPromise(promise(5))   // => true
