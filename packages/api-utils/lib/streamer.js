/* vim:set ts=2 sw=2 sts=2 expandtab */
/*jshint asi: true undef: true es5: true node: true devel: true
         forin: false latedef: false */
/*global define: true */

!(typeof(define) !== "function" ? function($){ $(typeof(require) !== 'function' ? (function() { throw Error('require unsupported'); }) : require, typeof(exports) === 'undefined' ? this : exports); } : define)(function(require, exports) {

'use strict';

var nil // Shortcut for undefined.

/**
 * Internal utility function that takes a `source` function and optional
 * `number` arguments and returns a function that calls `source` with a
 * given arguments only first `number` of times it's called. Useful for
 * wrapping callbacks that must be called only ones for example.
 */
function limit(source, number) {
  number = number || 1
  return function limited() {
    return number-- > 0 && source ? source.apply(this, arguments) : nil
  }
}

function normalize(source) {
  return function stream(next, stop) {
    var stopped = false, reading = true
    source(function onElement(element) {
      if (!stopped && false !== reading)
        return (reading = next(element))
    }, function onStop(reason) {
      return stopped ? nil : (stopped = true, stop(reason))
    })
  }
}

/**
 * Utility function that returns streams of elements of given `array`. This
 * function is dangerous as array mutations will have side effects on the
 * returned stream so it should be used with a care, reader of such stream
 * **MUST NOT** mutate source array, this is also reason why we don't export
 * this function.
 */
function streamArray(elements) {
  return function stream(next, stop) {
    var index = 0
    while (index < elements.length)
      // If stream reader interrupts reading we just return.
      if (false === next(elements[index++])) return false
    // Once all elements were yielded we stop a stream if such callback was
    // passed.
    if (stop) stop()
  }
}

/**
 * Creates stream of given elements.
 * @examples
 *    list('a', 2, {})(console.log)
 */
function list() {
  return streamArray(Array.prototype.slice.call(arguments))
}
exports.list = list

/*
 * Creates empty stream. This is equivalent of `list()`.
 */
function empty() {
  return function stream(next, stop) { return stop && stop() }
}
exports.empty = empty

/**
 * Returns stream of mapped values.
 * @param {Function} lambda
 *    function that maps each value
 * @param {Function} input
 *    source stream to be mapped
 * @examples
 *    var stream = list({ name: 'foo' },  { name: 'bar' })
 *    var names = map(function(value) { return value.name }, stream)
 *    names(console.log)
 *    // 'foo'
 *    // 'bar'
 *    var numbers = list(1, 2, 3)
 *    var mapped = map(function onEach(number) { return number * 2 }, numbers)
 *    mapped(console.log)
 *    // 2
 *    // 4
 *    // 6
 */
function map(lambda, source) {
  return function stream(next, stop) {
    source(function onElement(element) {
      return next(lambda(element))
    }, stop)
  }
}
exports.map = map

/**
 * Returns stream of filtered values.
 * @param {Function} lambda
 *    function that filters values
 * @param {Function} source
 *    source stream to be filtered
 * @examples
 *    var numbers = list(10, 23, 2, 7, 17)
 *    var digits = filter(function(value) {
 *      return value >= 0 && value <= 9
 *    }, numbers)
 *    digits(console.log)
 *    // 2
 *    // 7
 */
function filter(lambda, source) {
  return function stream(next, stop) {
    source(function onElement(element) {
      return lambda(element) ? next(element) : true
    }, stop)
  }
}
exports.filter = filter

/**
 * Returns stream of reduced values
 * @param {Function} source
 *    stream to reduce.
 * @param {Function} reducer
 *    reducer function
 * @param initial
 *    initial value
 * @examples
 *    var numbers = list(2, 3, 8)
 *    var sum = reduce(function onElement(previous, current) {
 *      return (previous || 0) + current
 *    }, numbers)
 *    sum(console.log)
 *    // 13
 */
function reduce(reducer, source, initial) {
  return function stream(next, stop) {
    var value = initial
    source(function onElement(element) {
      value = reducer(value, element)
    }, function onStop(error) {
      if (error) return stop(error)
      next(value)
      if (stop) stop()
    })
  }
}
exports.reduce = reduce

/**
 * This function returns stream of tuples, where the n-th tuple contains the
 * n-th element from each of the argument streams. The returned stream is
 * truncated in length to the length of the shortest argument stream.
 * @params {Function}
 *    source steams to be combined
 * @examples
 *    var a = list([ 'a', 'b', 'c' ])
 *    var b = list([ 1, 2, 3, 4 ])
 *    var c = list([ '!', '@', '#', '$', '%' ])
 *    var abc = zip(a, b, c)
 *    abs(console.log)
 *    // [ 'a', 1, '!' ]
 *    // [ 'b', 2, '@' ]
 *    // [ 'c', 3, '#' ]
 */
var zip = (function Zip() {
  // Returns weather array is empty or not.
  function isEmpty(array) { return !array.length }
  // Utility function that check if each array in given array of arrays
  // has at least one element (in which case we do have a tuple).
  function hasTuple(array) { return !array.some(isEmpty) }
  // Utility function that creates tuple by shifting element from each
  // array of arrays.
  function shiftTuple(array) {
    var index = array.length, tuple = []
    while (0 <= --index) tuple.unshift(array[index].shift())
    return tuple
  }

  return function zip() {
    var sources = Array.prototype.slice.call(arguments)
    return function stream(next, stop) {
      var buffers = [], id, reason, isStopped = false, shortest

      function onElement(id, element) {
        // If resulting stream is already stopped (we are in truncate mode) or
        // if this stream is stopped (we deal with badly implemented stream that
        // yields value after it's stopped) we ignore element.
        if (isStopped) return null
        // Otherwise we buffer an element.
        buffers[id].push(element)
        // If tuple is ready we yield it.
        return hasTuple(buffers) ? next(shiftTuple(buffers)) : true
      }

      function onStop(id, error) {
        // If shortest stream was already stopped then we are in truncate mode
        // which means we ignore all the following stream stops.
        if (isStopped) return null
        // If stream being stopped is the first one to be stopped or if it's
        // shorter then the shortest one stopped, we update stop reason and
        // shortest stopped stream reference.
        if (!shortest || shortest.length > buffers[id].length) {
          shortest = buffers[id]
          reason = error
        }
        // If shortest stream has no buffered elements, we stop resulting stream
        // & do some clean up.
        if (!shortest.length) {
          // Marking stream as stopped.
          isStopped = true
          // Stopping a stream.
          stop(reason)
          // Setting all closure captured elements to `null` so that gc can
          // collect them.
          buffers = shortest = null
        }
      }

      // Initializing buffers.
      id = sources.length
      while (0 <= --id) buffers.push([])

      // Start reading streams.
      id = sources.length
      while (0 <= --id)
        sources[id](onElement.bind(null, id), onStop.bind(null, id))
    }
  }
})()
exports.zip = zip

/**
 * Returns stream containing first `n` elements of given `source`, on which
 * given lambda returns `true`.
 *
 * @param {Function} lambda
 *    function that takes elements.
 * @param {Function} source
 *    source stream to take elements from.
 * @examples
 *    var numbers = list(10, 23, 2, 7, 17)
 *    var digits = take(function(value) {
 *      return value >= 10
 *    }, numbers)
 *    digits(console.log)
 *    // 10
 *    // 23
 */
function take(lambda, source) {
  return function stream(next, stop) {
    source(function onElement(element) {
      return lambda(element) ? next(element) : stop() && false
    }, stop = limit(stop))
  }
}
exports.take = take

/**
 * Returns a stream consisting of the given `source` stream elements starting
 * form the `start` zero-based index till `end` zero-based index element. If
 * `end` is not passed all elements will be included.
 */
function slice(source, start, end) {
  // Zero-based index at which to begin extraction.
  start = start || 0
  // Zero-based index at which to end extraction
  end = end || Infinity
  return function stream(next, stop) {
    var index = 0
    filter(function(element) {
      return start <= index ++
    }, source)(function onElement(element) {
      return next(element), index >= end ? (stop(), false) : true
    }, stop = limit(stop))
  }
}
exports.slice = slice

/**
 * Returns a stream containing only first `number` of elements of the given
 * `source` stream or all elements, if `source` stream has less than `number`
 * of elements. If `number` is not passed it defaults to `1`.
 * @param {Function} source
 *    source stream
 * @param {Number} number=1
 *    number of elements to take from stream
 */
function head(source, number) {
  return slice(source, 0, number && number >= 0 ? number : 1)
}
exports.head = head

/**
 * Returns a stream equivalent to given `source` stream, except that the first
 * `number` of elements are omitted. If `source` stream has less than `number`
 * of elements, then empty stream is returned. `number` defaults to `1` if it's
 * not passed.
 * @param {Function} source
 *    source stream to return tail of.
 * @param {Number} number=1
 *    Number of elements that will be omitted.
 */
function tail(source, number) {
  return slice(source, number && number >= 0 ? number : 1)
}
exports.tail = tail

/**
 * Returns a stream that contains all elements of each stream in the order they
 * appear in the original streams. If any of the `source` streams is stopped
 * with an error than it propagates to the resulting stream and it also get's
 * stopped.
 * @examples
 *    var stream = append(list(1, 2), list('a', 'b'))
 *    stream(console.log)
 *    // 1
 *    // 2
 *    // 'a'
 *    // 'b'
 */
function append() {
  var streams = Array.prototype.slice.call(arguments, 0)
  return function stream(next, stop) {
    var source, sources = streams.slice(0)
    function onStop(error) {
      if (error) return stop && stop(error)
      if ((source = sources.shift())) source(next, onStop)
      else return stop && stop()
    }
    onStop()
  }
}
exports.append = append

/**
 * Returns a stream that contains all elements of each stream of the given
 * source stream. `source` is stream of streams whose elements will be contained
 * by the resulting stream. Any error from any stream will propagate to the
 * resulting stream. Stream is stopped when all streams from `source` and source
 * itself is ended. Elements of the stream are position in order they are
 * delivered so it could happen that elements from second stream will appear
 * before or between elements of the first stream.
 * @param {Function} source
 *    Stream of streams whose elements will be contained by resulting stream
 * @examples
 *    function async(next, stop) {
 *      setTimeout(function() {
 *        next('async')
 *        stop()
 *      }, 10)
 *    }
 *    var stream = merge(list(async, list(1, 2, 3)))
 *    stream(console.log)
 *    // 1
 *    // 2
 *    // 3
 *    // 'async'
 */
function merge(source) {
  return function stream(next, stop) {
    var open = 1, alive
    function onStop(error) {
      if (!open || false === alive) return false
      if (error) open = 0
      else open --

      if (!open) stop(error)
    }
    source(function onStream(stream) {
      open ++
      stream(function onNext(value) {
        return open && false !== alive ? alive = next(value) : false
      }, onStop)
    }, onStop)
  }
}
exports.merge = merge

/**
 * Utility function to print streams.
 * @param {Function} stream
 *    stream to print
 * @examples
 *    print(list('Hello', 'world'))
 */
function print(stream) {
  console.log('>>')
  stream(console.log.bind(console), function onStop(error) {
    if (error) console.error(error)
    else console.log('<<')
  })
}
exports.print = print

/**
 * Returns a stream equivalent to a given `source`, with difference that
 * all the consumers will start reading it from the point it's at the given
 * moment. This is useful with streams such as user generated events (clicks,
 * keypress, etc..) where multiple stream readers might need to read from the
 * same source. In other words, this is your
 * [pub / sub](http://en.wikipedia.org/wiki/Publish/subscribe) for streams.
 * @param {Function} source
 *    Stream whose elements get published to a subscribers.
 * @return {Function}
 *    Stream that multiple subscribers can read from.
 * @examples
 *    function range(start, end) {
 *      return function stream(next, stop) {
 *        var number = start - 1
 *        setTimeout(function onNext() {
 *          if (++number >= end)
 *            return stop()
 *          if (false !== next(number))
 *            setTimeout(onNext, 2)
 *        }, 2)
 *      }
 *    }
 *    function printer(index) {
 *      return function print(stream) {
 *        stream(console.log.bind(console, '#' + index + '>'),
 *               console.log.bind(console, '<#' + index))
 *      }
 *    }
 *    var numbers = range(1, 5)
 *    printer(1)(numbers)
 *    setTimeout(function () { printer(2)(numbers) }, 5)
 *
 *    // Output will look something like this:
 *    #1> 1
 *    #1> 2
 *    #1> 3
 *    #2> 1
 *    #1> 4
 *    #2> 2
 *    <#1
 *    #2> 3
 *    #2> 4
 *    <#2
 *
 *    // If you noticed second print started form the first `1` element. Now
 *    // lets do similar thing with a hub.
 *
 *    var numbers = hub(range(1, 5))
 *    printer(1)(numbers)
 *    setTimeout(function () { printer(2)(numbers) }, 5)
 *
 *    // In this case output will be different:
 *
 *    #1> 1
 *    #1> 2
 *    #1> 3
 *    #1> 4
 *    #2> 4
 *    <#1
 *    <#2
 *
 *    // Notice this time second print only printed only following elements.
 */
function hub(source) {
  var listeners = [], isStopped = false, reason
  source(function onNext(element) {
    var index = 0
    // Maybe it'd be better to just iterate on sliced array instead ?
    while (index < listeners.length) {
      if (listeners[index++][0](element) === false)
        listeners.splice(--index, 1)
    }
  }, function onStop(error) {
    isStopped = true
    reason = error
    var listener, stop
    while ((listener =  listeners.shift())) {
      if ((stop = listener[1])) stop(reason)
    }
  })
  return function stream(next, stop) {
    // If stream is already stopped, we notify a listener.
    if (isStopped && stop) stop(reason)
    // Else we register listener.
    else listeners.push([ next, stop ])
  }
}
exports.hub = hub

/**
 * Returns a stream equivalent to a given `source` by caching all it's elements
 * into memory for faster reads. This is useful with `source` streams that are
 * expensive to compute (requires access to the network for example). Use it
 * carefully though, do not cache infinite streams and be aware that
 * asynchronous stream when cached will yield some or all elements
 * synchronously. Also be aware, that unlike other functions, this is greedy
 * which means that it will start reading `source` stream immediately.
 * @param {Function} source
 *    source stream to cache.
 * @returns {Function}
 *    cached equivalent of source that can be read multiple times.
 */
function cache(source) {
  var buffer = []
  // Creating a stream that streams element of the buffer array.
  function cached(next, stop) {
    var index = 0
    while (index < buffer.length)
      if (false === next(buffer[index++])) return false
    stop()
  }
  return append(cached, hub(function stream(next, stop) {
    source(function onElement(element) {
      buffer.push(element)
      return next(element)
    }, stop)
  }));
}
exports.cache = cache

/**
 * Returns stream equivalent to a given `source` with a difference that it has
 * a state, meaning that if reader stops reading on n-th element next reader
 * will continue reading from n-th element. Purpose is to wrap any other type
 * of stream, such that each element of `source` can be read only once. This
 * allow element distribution across different consumers with a help of `head`,
 * `tail` and similars.
 * @param {Function} source
 *    source stream to create stack stream from.
 * @returns {Function}
 *    stack equivalent of source that can be read only once.
 */
function stack(source) {
  var readers = [], buffer = [], isStopped = false, isStarted = false, reason,
      updating = false

  function update() {
    if (updating || !buffer.length || !readers.length) return nil
    updating = true
    var resume = readers[0][0](buffer.shift())
    if (false === resume) readers.shift()
    update(updating = false)
  }

  function onNext(element) {
    update(buffer.push(element))
  }

  function onStop(error) {
    isStopped = true
    reason  = error
    var reader = readers.shift()
    return reader ? onStop(error, reader[1] && reader[1](error)) : nil
  }

  return function stream(next, stop) {
    // If stream is already stopped, we notify a listener.
    if (isStopped && !buffer.length) return stop && stop(reason)

    readers.push([ next, stop ])
    update()

    // If `source` stream is not yet being read, start reading it.
    if (isStarted) return nil
    isStarted = true
    source(onNext, onStop)
  }
}
exports.stack = stack

/**
 * Returns a stream that contains all elements of each stream of the given
 * source stream. `source` is stream of streams whose elements will be contained
 * by the resulting stream. Any error from any stream will propagate to the
 * resulting stream. Stream is stopped when all streams from `source` and source
 * itself are ended. Elements of the stream are position in order, all elements
 * of first stream, all elements of second stream etc.
 * @param {Function} source
 *    Stream of streams whose elements will be contained by resulting stream
 * @examples
 *    function async(next, stop) {
 *      setTimeout(function() {
 *        next('async')
 *        stop()
 *      }, 10)
 *    }
 *    var stream = join(list(async, list(1, 2, 3)))
 *    stream(console.log)
 *    // 'async'
 *    // 1
 *    // 2
 *    // 3
 */
function join(source) {
  return function stream(next, stop) {
    var streams = stack(source), open = 2, alive = true, stopped = false

    function onStop(error) {
      open --
      if (error && !stopped) open = false, stopped = true, stop(error)
      else if (!open && !stopped) stopped = true, stop()
    }
    !function recur(error) {
      onStop(error)
      head(streams)(function onStream(stream) {
        // Increment number of open steams (twice since we decrement twice
        // once on stream close and second on slice close).
        open += 2
        stream(function onElement(element) {
          // If steam is still open and read is not interrupted we pipe all
          // elements to the reader. Otherwise we interrupt reading.
          return !stopped && open && false !== alive ?
                 alive = next(element) : false
        }, recur)
      }, onStop)
    }()
  }
}
exports.join = join

});
