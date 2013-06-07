# signalize

[![Build Status](https://secure.travis-ci.org/Gozala/signalize.png)](http://travis-ci.org/Gozala/signalize)

[![Browser support](https://ci.testling.com/Gozala/signalize.png)](https://ci.testling.com/Gozala/signalize)

[Functional Reactive Programming][FRP] (FRP) is a programming paradigm for
working with *time-varying* values, better capturing the temporal aspect of
mutable state. Signal is a data structure representing a time-varying value.
For example, consider the position of the mouse. The signal `mousePosition`
represents current mouse position. When the mouse moves, the value changes
automatically.

Signals can also be transformed and combined without typical hazards of the
stateful programs.

# Example

Signal is very low level construct that can be used to create signals from
scratch:

```js
var signal = require("signalize/core").signal
var time = signal(function(next) {
  setInterval(function() {
    next(Date.now())
  }, 1000)
})
```

Signals can be spawned in order to consume it's changes:

```js
var spawn = require("signalize/core").spawn

spawn(time, function(value) {
  console.log(value)
})

// => 1352077824718
// => 1352077825719
// => 1352077826720
// => 1352077827721
// => 1352077828722
// => 1352077829723
```


## Install

    npm install signalize

[FRP]:http://en.wikipedia.org/wiki/Functional_reactive_programming
