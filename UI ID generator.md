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
`sdk/util/uuid` to generate ids.

### API

#### Exports

* `identify(thing)`: makes and/or gets a unique ID for the input.

### Examples

#### Making an ID

```js
const { identify } = require('sdk/ui/id');

const Thingy = Class({
  initialize: function(details) {
    let id = identify(this);
  }
});
```

#### Getting an ID

```js
const { identify } = require('sdk/ui/id');
const { Thingy } = require('./thingy');

let thing = Thingy(/* ... */);
let thingID = identify(thing);
```

#### Defining ID generator

```js
const { identify } = require('sdk/ui/id');

const Thingy = Class(/* ... */);

identify.define(Thingy, thing => thing.guid);
```
