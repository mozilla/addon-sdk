## Proposal

Since all UI elements require IDs, there should be both a function
for generating IDs that are unique, and a function for retrieving
IDs for instances of UI Classes.

### Use Cases

Sidebars, Buttons, Menuitems, Context Menuitems, Widgets, Panels, or
any other UI modules.

## Implementation

Using the `method/core` module, it will be possible to define
specific generators and getters for known types, otherwise
a default generator will be used which will rely on
`sdk/util/uuid` to generate ids with a `jetpack-` prefix.

### API

#### Exports

* `makeID(thing)`: Makes a unique ID for the input.
* `getID(thing)`: Gets the ID assoicated with input

### Examples

#### Making an ID

```js
const { makeID } = require('sdk/ui/id');

const Thingy = Class({
  initialize: function(details) {
    let id = makeID(this);
  }
});
```

#### Getting an ID

```js
const { getID } = require('sdk/ui/id');
const { Thingy } = require('./thingy');

let thing = Thingy(/* ... */);
let thingID = getID(thing);
```

#### Defining ID generator

```js
const { makeID } = require('sdk/ui/id');

const Thingy = Class(/* ... */);

makeID.define(Thingy, function(thing) {
  let id = makeID().split('-');
  id.splice(1, 0, 'thingy');
  return id.join('-');
});
```
