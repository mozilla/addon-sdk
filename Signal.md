Functional Reactive Programming ([FRP][]) is a high-level way to work with
interactions. It provides control flow structures for time.

[FRP][] is built around the idea of time-varying values. Different papers
have different names, semantic, pros & cons for those values. Some of them
(like Microsoft [RX][]) has notion of events & behaviors (which are made of
events, but represent state). Others like ([Elm][]) avoid complexity of
multiple abstractions (with mostly similar control flow structures) in favor
of defining data type for time-varying values in form of *Signals*. Later
approach also seems to be a better match for SDK so this proposal is mostly
follows symantics defined by [Elm research paper][].

## Why is FRP a good idea?

Big part of the code in SDK hooks into varios system / DOM events to react
to a specific firefox component state changes. This usually implies objects
that at the begining of their lifetime wire up to events they're interested
and at the end of the lifetime they take care of cleanup, in practice this
tends to be even more complicated as some of the wiring happens at different
states of the object lifetime. A lot of bugs tend to be caused by timing at
which this wiring happens. It is also hard to reproduce some of the bugs
as they are timing bugs. As a side effect SDK components also tend to be
tidely coupled with event flow, which (arguabely) makes reasoning about code
a lot more complicated. In form of list this can be summarized as:

- Timing bugs.
- Lot of wiring and cleanup tasks.
- Event flow nested through varios Class / Object constructs.
- No simple way to view "current" state.
- Hard to support multi process architecture.
- Hard to share code across add-ons.

FRP solves all of the above problems if applied correctly. Signals provide a
declarative interface for defining event flows. Signals completely isolate
state control flow from the rest of the logic which makes it easy to share
control flow logic across different add-ons or even put it into another
process.

## Intro

It's helps to think of a signal as a *cell* in a [Spreadsheet][]. There are
usually base cells containing data and derived cells who's data is generated
from a formula & other cell's data. Modifying data in base cells automaticall
modifies data in the derived cells. This is exactly how signals work, there
are base signals representing application state from which derived signals are
created via varios control flow functions. Application state changes are
reflected on the base signals and propagate through the rest of the derived
signals.

## Control flow structures

This proposal tryies to leverage prior art instead of inventing a new approach,
there for all control flow functions are ones present in [Elm signal API][].


#### constant(x)

Create a constant signal that never changes.

```js
const { constant } = require("elmjs/signal")
const one = constant(1)
```

#### lift(step, input)

Transform a signal with a given function.

Sometimes people try to make analogy with `map` function, but that is
misleading & wrong. The best way to think of `lift` is that it lifts
given function to operate on signal (time-varying value). Again think
of formulas and cells, formulas don't just caluculate value from current
cell values but rather produce time-varying value which changes any time
values in cells are changed.


```js
const { lift } = require("elmjs/signal")
const Y = lift(x => x + 1, X)
// X   x: --x1----x2-----x3---x4--------x5---
// Y x+1: --x1+1--x2+1---x3+1-x4+1------x5+1-
```

Lift can also be used to combine two (or more) signals (again like formulas):

```js
const XY = lift((x, y) => x + y, X, Y)
```

Above example produces XS signal who's value changes any time `X` or `Y`
changes.


#### merge(xs, ys, ...etc)

Merge two signals into one, biased towards the first signal if both signals
update at the same time.

```js
const XY = merge(X, Y)
// XS  x: --x1------x2--------x3-----
// YS  y: -----y1-------y2----y3-----
// XY  x: --x1-y1---x2--y2----y3-x3--
```

#### merges([xs, ys, ...etc])

Similar to `merge` but instead of taking signals as arguments it takes
array of signals and merges them togather.

```js
const XY = merges([X, Y])
// X   x: --x1------x2--------x3-----
// Y   y: -----y1-------y2----y3-----
// XY  x: --x1-y1---x2--y2----y3-x3--
```

#### combine([xs, ys, ...etc])

Combine an array of signals into a signal of arrays. It more or less can
be defined as `const combine = inputs => lift(Array, ...inputs)`:

```js
const Point = combine([X, Y])
// X         0: ---x1----------------------------x2-------
// Y         1: -----------y1--------y2-------------------
// Point [0,1]: ---[x1,1]--[x1, y1]--[x1,y2]-----[x2,y2]--
```

### Past-Dependence

#### foldp(step, initial, input)

Create a past-dependent signal. Each value given on the input signal
will be accumulated, producing a new output value.


```js
const Y = foldp((past, x) => past + x, 5, X)
// X    x: ---1-----2-------3-----4-------x----
// Y    5: ---6-----8-------11----15------15+x-
```

#### count(input)

Count the number of value changes that have occured.

```js
const N = count(X)
// X    x: ---x-----x---x---x----x--
// N    0: ---1-----2---3---4----5--
```

#### countIf(p, input)

Count the number of events that have occured that satisfy a given predicate.

```js
const N = countIf(isEven, X)
// X    x: ---1-----2---3---4----5--
// N    0: ---------1-------2-------
```

### Filters

### keepIf(p, base, input)

Keep only events that satisfy the given predicate. Since signal is time-varying
value, a base case must be provided in case the predicate is never satisfied.

```js
const Y = keepIf(isEven, 0, X)
// X    1: ---2-----3---4---5----6--
// F    0: ---2---------4--------6--
```

#### dropIf(p, base, input)

Drop events that satisfy the given predicate. Since signal is time-varying value,
a base case must be provided in case the predicate is never satisfied.

```js
const Y = dropIf(isEven, 0, X)
// X    1: ---2-----3---4---5----6--
// F    1: ---------3-------5-------
```

#### keepWhen(Switch, base, Data)

Keep events only when the first signal is `true`. When the first signal
becomes `true`, the most recent value of the second signal will be propagated.
Until the first signal becomes `false` again, all events will be propagated.
Since signal is time-varying value, a `base` case must be provided in case
the first signal is never `true`.

```js
const Y = keepWhen(Enabled, 0, X)
// Enabled  1: -----------0----------1---------0------
// X        x: --x1---x2-----x3--x4-------x5------x6--
// Y        x: --x1---x2-------------x4---x5----------
```

#### dropWhen(Switch, base, Data)

Drop events when the first signal is `true`. When the first signal
becomes `false`, the most recent value of the second signal will be
propagated. Until the first signal becomes `true` again, all events
will be propagated. Since signal is time-varying value, a `base` case
must be provided in case the first signal is never `true`.

```js
const Y = dropWhen(Disabled, 0, X)
// Disabled  1: -----------0----------1---------0------
// X         x: --x1---x2-----x3--x4-------x5------x6--
// Y         0: -----------x2-x3--x4------------x5-x6--
```

#### dropRepeats(X)

Drop sequential repeated values. For example, if a signal produces
the sequence [1,1,2,2,1], it becomes [1,2,1] by dropping the values
that are the same as the previous value.

```js
const Y = dropRepeats(X)
// X   0: --1---1---2-----2---1--
// Y   0: --1-------2---------1--
```


#### sampleOn(Beat, Data)

Sample from the second input every time an event occurs on the first
input. For example, `sampleOn(clicks, every(second))` will give the
approximate time of the latest click.

```js
const Y = sampleOn(T, X)

// X    x:-x1----x2---x3-----x4--x5-----x6-----
// T    t:----t-----t-----t-----------t----t---
// Y    x:----x1----x2----x4----------x5---x6--
```


### Signal internals

The core construct provided is the `Input` type/class. All signals will be
nnstances of `Input`. It is assumed that state changes in application like
window open / close, tab loaction change, etc.. are gonig to exposed via
base signals.

#### Signals maybe finite

The lifetime of base signals (and there for or derived signals) is going to
match lifetime of an add-on (from being loaded until being unloaded). This
implies that that signals can have an end (good analogy is EOF), which is
just a special finalizing value.

#### Signals are lazy

Signals do any work only if being used/consumed otherwise they don't waste
any resources. For example underlaynig signal implemntation may relay on
observer service to update it's state. Signal should only register observer
if it's being used.

There for signals can be started or stopped, when started they will register
observers when stopped they will unregister observers. There are `start(signal)`
and `stop(signal)` functions provided by a signal library, but they are not
supposed to be used by signal consumers. They are marily for implementing
custom base signals that need to do something when signal is started or
stopped.

SDK will provide an API to represent observer notifications in form of signals
but for (start and stop) ilustration purposes we going to show how it can be
defined:

```js
const { Cc, Ci } = require("chrome")
const { Input, start, stop, receive } = require("elmjs/signal")

const { addObserver, removeObserver } = Cc['@mozilla.org/observer-service;1'].
                                          getService(Ci.nsIObserverService);

const InputPort = function(topic, initial) {
  this.topic = topic
  this.value = initial
}
InputPort.prototype = new Input();
InputPort.prototype[start] = input => {
  addObserver(input, input.topic, false)
}
InputPort.prototype[stop] = input => {
  removeObserver(input, input.topic)
}
InputPort.prototype.observe = function(subject, topic, data) {
  receive(this, subject)
}
```

Note: Function `recieve(signal, message)` updates value of the
signal to a second argument and propagates changes to all the derived
signals but we get to that later.

With the above helper function it's possible to create bunch of
derived signals:

```js
const LastOpenedWindow = InputPort("domwindowopened", null)
const LastClosedWindow = InputPort("domwindowclosed", null)
const LastWindowChange = merge(lift(x => [true, x], LastOpenedWindow),
                               lift(x => [false, x], LastClosedWindow))
const OpenedWindows = foldp((past, [isOpened, window]) => {
  let current = new Set(past)
  if (isOpened)
    current.add(window)
  else
    current.delete(window)

  return current
}, new Set(), LastWindowChange)
```

Note: It may seem that above code does bunch of things, but realisticly
it just declares logic of the data flow. This code won't cause any of
the inlined functions to execute, even observers won't be registered,
that is because no of the above signals have consumers.

In order to start signal network up one needs to commit to writing
(maybe processing is a better term) every state change as follows:

```js
const { write } = require("elmjs/signal")

write({
  start: initial => {
    // do something with an initial state
  },
  next: state => {
    // do something every state changes
  },
  end: state => {
    // do something with most recent state
  }
}, OpenedWindows)
```

Write above will start `OpenedWindows` signal, which will start
`LastWindowChange` since it derives from it, which will start
`LastOpenedWindow` and `LastClosedWindow` and that's where actual
observers will be added.

Note: [Elm][] does not provides equivalent of write, instead
`main` of the program is a signal which is implicitly written
(rendered to be precise) on a screen.

It is important to have one write per component to eliminate all
the timing issues and to reduce all the side effects to single
place. This enables cool features like record / reply of a bug
scenario very easily.


#### Combining components

In practice SDK often needs to track state of separate components
and react to a changes in either one. At first glance it may
require multiple `write` calls, although there are other ways:


```js
const hashmap = (key, value) => {
  let result = {}
  result[key] = value
  return result
}

const nullify = hashmap => {
  let result = {}
  for (let id of Object.keys(hashmap))
    result[id] = null
  return result
}

const LastAddition = lift(x => hashmap(x.id, x),
                          InputPort("menu-item-add", null))

const LastDeletion = lift(x => hashmap(x.id, null),
                          InputPort("menu-item-removed", null)

const LastUpdate = InputPort("menu-item-update", null)


const MenuItems = foldp((past, change) => merge({}, past, change),
                        {},
                        merge(LastAddition, LastDeletion, LastUpdate))

const WindowsWithMenuItems = combine(MenuItems, InteractiveWindows)

const updateMenuItems = (items, windows) => {
  for (let window of windows) {
    for (let id of Object.keys(items)) {
      let item = items[id]
      if (item === null)
        removeMenuItem(window, id)
      else if (hasMenuItem(window, id))
        updateMenuItem(window, item)
      else
        addMenuItem(window. item)
    }
  }
}

write({
  start: ([items, windows]) => updateMenuItems(items, windows),
  end: ([items, windows]) => updateMenuItem(nullify(items), windows),
  next: ([items, windows], [pastItems, pastWindows]) => {
    let itemsDelta = diff(pastItems, items)
    let windowDelta = diff(pastWindows, items)
    // Add all items to new windows
    updateMenuItems(items, windowDelta)
    // Add / remove items to all windows
    updateMenuItem(itemsDelta, windows)
  }
}, WindowsWithMenuItems)
```

Above code may seem like a lot but there are bunch of reusable parts that
can be factored out and reused across common cases.


#### Signals cleanup after themself

When signal looses all the consumers it atomaticall stops itself, which is
similar to starting propagates through the whole chain.
**NEED MORE DETAILS**


[Elm signal API]:http://docs.elm-lang.org/library/Signal.elm
[Elm]:http://elm-lang.org
[FRP]:http://en.wikipedia.org/wiki/Functional_reactive_programming
[Elm research paper]:http://www.testblogpleaseignore.com/wp-content/uploads/2012/04/thesis.pdf
[RX]:http://msdn.microsoft.com/en-us/data/gg577609.aspx
[Spreadsheet]:http://en.wikipedia.org/wiki/Microsoft_Excel