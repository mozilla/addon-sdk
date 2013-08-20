> _This JEP was implemented in [Bug 724632](https://bugzilla.mozilla.org/show_bug.cgi?id=724632), [Pull #617](https://github.com/mozilla/addon-sdk/pull/671)_

One of the big advantages that SDK APIs provide is an automatic
cleanup on unload. Unfortunately only consumers of high level APIs
take advantage of this. API implementations still register unload
hooks at instantiation and then clean up after them-self on unload
or unregister listeners. This is not ideal, requires boiler plate
code and is prone to error. All of the APIs today do something along
these lines

```js
require('unload').when(function() {
   while (bars.length) bars.shift().destroy()
});

var bars = [];
var Bar = Class({
  initialize: funciton(options) {
    // ....
    bars.push(this);
    // ...
  },

  /* .... */

  destroy: function() {
    // ...
    bars.splice(bars.indexOf(this), 1);
  }
});
```

## Goals

- Reduce boilerplate required for doing handling unloads
- Provide clean alternative to `unload.ensure` that would not require mutations
  and will work for frozen objects.
- Bake-in unload handling into core such that each module will no
  longer have to require `unload`.
  

## Solution

SDK could implement base class to take care of the main boilerplate.
All the rest APIs will just have to subclass and implement `dispose`
method to release resources associated with an instance, which can
happen either at destruction or on unload:


```js
var Foo = Class({
  extends: Disposable,
  // Disposable class implements `initialize` that registers
  // unload listener then delegates to `this.setup`. Unless
  // You need to do something earlier it's best to use `setup`
  // for initialization.
  setup: function setup(options) {
    // setup your instance
  },

  /* .... */
  
  // Disposable class implements `destroy` method that unregisters
  // unload listener and then delegates to `this.dispose`. If unload
  // happens before `destroy` listener registered by `initialize`
  // will delegate to `dispose` to let it cleanup after itself. 
  dispose: function dispose() {
  }
});
```
# Discussion

https://etherpad.mozilla.org/jetpack-disposable

# Prior art

- [.Net IDisposable][]
- [Java Disposable][]

[.Net IDisposable]:http://msdn.microsoft.com/en-us/library/system.idisposable.aspx#Y967
[Java Disposable]:http://docs.oracle.com/html/E15725_01/com/tangosol/util/Disposable.html