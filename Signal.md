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
const { merge } = require("elmjs/signal")
const XY = merge(X, Y)
// XS  x: --x1------x2--------x3-----
// YS  y: -----y1-------y2----y3-----
// XY  x: --x1-y1---x2--y2----x3-y3--
```

#### merges([xs, ys, ...etc])

Similar to `merge` but instead of taking signals as arguments it takes
array of signals and merges them togather.

```js
const { merges } = require("elmjs/signal")
const XY = merges([X, Y])
// X   x: --x1------x2--------x3-----
// Y   y: -----y1-------y2----y3-----
// XY  x: --x1-y1---x2--y2----y3-x3--
```

#### combine([xs, ys, ...etc])

Combine an array of signals into a signal of arrays. It more or less can
be defined as `const combine = inputs => lift(Array, ...inputs)`:

```js
const { combine } = require("elmjs/signal")
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
const { foldp } = require("elmjs/signal")
const Y = foldp((past, x) => past + x, 5, X)
// X    x: ---1-----2-------3-----4-------x----
// Y    5: ---6-----8-------11----15------15+x-
```

#### count(input)

Count the number of value changes that have occured.

```js
const { count } = require("elmjs/signal")
const N = count(X)
// X    x: ---x-----x---x---x----x--
// N    0: ---1-----2---3---4----5--
```

#### countIf(p, input)

Count the number of events that have occured that satisfy a given predicate.

```js
const { countIf } = require("elmjs/signal")
const N = countIf(isEven, X)
// X    x: ---1-----2---3---4----5--
// N    0: ---------1-------2-------
```

### Filters

### keepIf(p, base, input)

Keep only events that satisfy the given predicate. Since signal is time-varying
value, a base case must be provided in case the predicate is never satisfied.

```js
const { keepIf } = require("elmjs/signal")
const Y = keepIf(isEven, 0, X)
// X    1: ---2-----3---4---5----6--
// F    0: ---2---------4--------6--
```

#### dropIf(p, base, input)

Drop events that satisfy the given predicate. Since signal is time-varying value,
a base case must be provided in case the predicate is never satisfied.

```js
const { dropIf } = require("elmjs/signal")
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
const { keepWhen } = require("elmjs/signal")
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
const { dropWhen } = require("elmjs/signal")
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
const { dropRepeats } = require("elmjs/signal")
const Y = dropRepeats(X)
// X   0: --1---1---2-----2---1--
// Y   0: --1-------2---------1--
```


#### sampleOn(Beat, Data)

Sample from the second input every time an event occurs on the first
input. For example, `sampleOn(clicks, every(second))` will give the
approximate time of the latest click.

```js
const { sampleOn } = require("elmjs/signal")
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

#### Defining signals

**Disclaimer:** If you think you need to define your custom signal, think
twice, likely you don't.

SDK will provide an `InputPort` API to represent observer notifications in
form of signals. It is recommended to create signals using `InputPort`
instead of defining one from scratch. In the following section we'll define
naive implementation of `InputPort` for illustration purposes and to highlight
how internals of signals work.


##### Laziness


Laziness is a very important feauture of signals, which means that they won't
do any work (waste any resources) unless used/consumed. In our example it
means that `InputPort` should not even register observer, unless it's being
used.

To make such laziness possible, signals are designed such that they can be
started or stopped. There for observer should be register when signal is
started, which should be removed whon stopped. There are `start(signal)`
and `stop(signal)` functions provided by a signal library, that would
start / stop a signal, but again users should not ever do it, because
that's will interfer to built-in atomated process (we'll get back to that
later, now lets focus on implementation of signal itself):


```js
const { Cc, Ci } = require("chrome")
const { Input, start, stop, receive } = require("elmjs/signal")

const { addObserver, removeObserver } = Cc['@mozilla.org/observer-service;1'].
                                          getService(Ci.nsIObserverService);

const InputPort = function(topic, initial=null) {
  this.topic = topic
  this.value = initial
}
```

Note: Since signal is representation of state it should have some initial
state, that's what second argument stands for.


Most of the signal bases are implemented by `Input` abstract class which
we should inherit from:

```js
InputPort.prototype = new Input();
```

As already pointed out, to support laziness all the work should be initiated
when signal starts. To do that `start` hook should be implemented by an
instance (note that instance itself is passed as an argument):

```js
InputPort.prototype[start] = input => {
  addObserver(input, input.topic, false)
}
```

Signals also maybe stopped, that happens once no more consumers are left.
In less naive implementation we would end a signal like `end(input)` when
add-on is unloaded, which would cause it to loose all custumers and there
for `input` will be stopped.

```js
InputPort.prototype[stop] = input => {
  removeObserver(input, input.topic)
}
```

On actual notifications we update a state by receiving a message (new state).
`receive` takes care of propageting this change to all the derived signals
and updating `this.value` to received one:

```js
InputPort.prototype.observe = function(subject, topic, data) {
  receive(this, subject)
}
```

#### Modeling state

Creating dictionaries from key value pairs will be common enoungh task that
it makes sense to define utility function for this:

```js
const dictionary = (...pairs) => {
  let result = {}
  let index = 0
  const count = pairs.length
  while (index < count)
    result[pairs[index++]] = pairs[index++]

  return result
}
```

As already pointed out `InputPort` that will be provided by SDK should be enough
to cover base inputs, rest, could/should be modeled using available control flow
structures.


```js
const LastOpenedWindow = new InputPort("domwindowopened", null)
const LastClosedWindow = new InputPort("domwindowclosed", null)

const LastWindowChange = merge(lift(x => dictionary(getOuterId(x), x),
                                    LastOpenedWindow),
                               lift(x => dictionary(getOuterId(x), null),
                                    LastClosedWindow))

const OpenedWindows = foldp((state, update) => extend({}, state, update),
                            {},
                            LastWindowChange)
```

Note: It may seem that above code does bunch of things, but it isn't
thanks to laziness, it just declares logic of the data flow. All the
inlined functions will be executer only when signal gains consumers.

#### Consuming signals

In order to start network of signals one needs to consume it. This can
be achieved using `Reactor`-s that will react to changes on a signal
(Note that handler: `onStart`, `onNext` & `onEnd` are all optional):

```js
const { Reactor } = require("elmjs/signal")

const reactor = new Reactor({
  onStart: initial => {
    // do something with an initial state
  },
  onNext: (current, previous) => {
    // do something every state changes
  },
  onEnd: previous => {
    // do something with most recent state
  }
})

reactor.run(OpenedWindows)
```

Once reactor is `run` it will start given `OpenedWindows` signal, which
subsequently will start `LastWindowChange` as it derives from it, that
will cause `LastOpenedWindow` and `LastClosedWindow` to be started, finally
invoking our `InputPort.prototype[start]` function that will register
observers.

Note: [Elm][] does not provides equivalent of `Reactor`, because runtime
takes care of this. Instead `main` of the program is a signal which is
implicitly consumed by a renderer.

It is important to have one `reactor.run` per component as that eliminate
all the race conditions caused by timing. In addition all the side effects
will happen in single place which avoids whole class of out of sync problems
and makes tracking bugs easier. This also enables cool features like record
/ reply of a bug scenario (which we'll hopefully build after :).


#### Combining components

In practice SDK often needs to track state of separate components
and react to a changes in either one of them. At first glance it
may require multiple `Reactor` runs, although there are better ways
to handle it.

Next we will define some base signals using `InputPort`, assume that's where
we're going to receive updates for menu items. Each update will be in a form
of `{ id: "menuitem-1", label: "Some Text", ... }` always containing `id` and
fields that were updated:

```js
const LastAddition = lift(x => dictionary(x.id, x),
                          new InputPort("menu-item-add", null))

const LastDeletion = lift(x => dictionary(x.id, null),
                          new InputPort("menu-item-removed", null)

const LastUpdate = new InputPort("menu-item-update", null)
```

Using above base inputs collective state of all menu items can be modeled by
mergeing all updates starting form blank initial state:


```js
const ItemsState = foldp((past, change) => extend({}, past, change),
                         {},
                         merge(LastAddition, LastDeletion, LastUpdate))
```

Menu items can be owned by different windows, there state should contain that
data too:

```js
const MenuItems = lift((items, windows) => {
  return Object.keys(items).reduce((result, id) => {
    const menuItem = menuItems[id]
    result[id] = menuItem && extend({}, menuItems, { owners: windows })
    return result
  }, {})
}, ItemsState, InteractiveWindows)
```

Now all is needed is a reactor that will reflect updates on menu item views / models:

```js
const eachOwner = fn => item => Object.keys(items.owners).forEach(id => {
  fn(owners[id], item)
})

const updateItem = eachOwner(updateMenuItemIn)
const deleteItem = eachOwner(removeMenuItemFrom)

const reactor = new Reactor({
  // Note: onStart is obsolete since at start there will
  // be no menu items.
  onNext: (current, past) => {
    Object.keys(current).forEach(id => {
      const menuItem = current[id]
      if (!menuItem) deleteItem(past[id])
      else update(menuItem)
    })
  },
  onEnd: past => {
    Object.keys(past).forEach(id => deleteItem(past[id]))
  }
})
reactor.start(MenuItems)
```

Above code may be simplified a lot more by factoring out common parts
that deals with [diff][]ing & [patch][]ing hashes (for example see
[diffpatcher] library).

Reactor instance also seems to be hanling quite generic task of going
through each change and reflecting appropriately. It would make sense
to create a subclass that would reduce some boilerplate there as well.


[Elm signal API]:http://docs.elm-lang.org/library/Signal.elm
[Elm]:http://elm-lang.org
[FRP]:http://en.wikipedia.org/wiki/Functional_reactive_programming
[Elm research paper]:http://www.testblogpleaseignore.com/wp-content/uploads/2012/04/thesis.pdf
[RX]:http://msdn.microsoft.com/en-us/data/gg577609.aspx
[Spreadsheet]:http://en.wikipedia.org/wiki/Microsoft_Excel
[patch]:https://github.com/Gozala/diffpatcher#patch
[diff]:https://github.com/Gozala/diffpatcher#diff
[diffpatcher]:https://github.com/Gozala/diffpatcher
