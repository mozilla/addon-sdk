# package.json

Below is a table of fields supported by the current cfx, node.js package.json format, and plans for support in the new jpm.

* :white-check-mark: this property is supported
* :x: this is not supported
* :o: this property will be supported as a fallback and should be considered deprecated
* :warning: this property works differently than other or previous implementations, noted in detail below.
* :grey_question: is asking, "Should we support this property?"

There are also additional fields used in node.js that can be helpful for those who share addon code, but not something we necessarily have to account for ("bugs", "repository") in AOM, so these will not be listed, and node-only fields will also not be listed.

| field        | cfx              | node             | jpm             |
|--------------|------------------|------------------|-----------------|
|name          |:white-check-mark:|:white-check-mark:|:white-check-mark:
|fullName      |:white-check-mark:|:x:               |:o:             
|title         |:white-check-mark:|:x:               |:white-check-mark:
|description   |:white-check-mark:|:white-check-mark:|:white-check-mark:
|main          |:white-check-mark:|:white-check-mark:|:white-check-mark:
|version       |:white-check-mark:|:white-check-mark:|:white-check-mark:
|author        |:white-check-mark:|:white-check-mark:|:white-check-mark:
|contributors  |:white-check-mark:|:white-check-mark:|:white-check-mark:
|translators   |:white-check-mark:|:x:               |:white-check-mark:
|license       |:white-check-mark:|:white-check-mark:|:white-check-mark:
|homepage      |:white-check-mark:|:white-check-mark:|:white-check-mark:
|dependencies  |:warning:         |:white-check-mark:|:white-check-mark:
|packages      |:white-check-mark:|:x:               |:x:
|harnessClassID|:white-check-mark:|:x:               |:x:
|icon          |:white-check-mark:|:x:               |:white-check-mark:
|icon64        |:white-check-mark:|:x:               |:white-check-mark:
|id            |:white-check-mark:|:x:               |:white-check-mark:
|lib           |:white-check-mark:|:x:               |:x:
|engines       |:x:               |:white-check-mark:|:white-check-mark:
|[engineStrict](https://npmjs.org/doc/json.html#engineStrict)  |:x:               |:white-check-mark:|:grey_question:
|permissions   |:white-check-mark:|:x:               |:white-check-mark:
|preferences   |:white-check-mark:|:x:               |:white-check-mark:
|tests         |:white-check-mark:|:x:               |:white-check-mark: :grey_question
|aliases       |:x:               |:x:               |:white-check-mark:

### `author`, `contributors`, `translators`

We should also support [node-style "people" fields](https://npmjs.org/doc/json.html#people-fields-author-contributors) for these fields.

### `dependencies`

In cfx, `dependencies` can be a string or an array of strings. In jpm, we will be using the node-style convention of an object with package names as keys and versions as values and leveraging npm for dependency management.

### `id`

This probably should still be used. Generating a random id, with the user able to override it.

### `tests`

Currently in cfx, `tests` is a string representing the test directory, defaulting ot `tests`. In new jpm, perhaps this should be a glob string `'./test/test.*.js'` or something like that, or an array of test names. Would also allow filtering tests without using a CLI.

### `aliases`

This can be used as user-editable `mapping` for the loader. An object that can take a value and map it to either a local file or another module accessible to the loader.

```
"dependencies": {
  "fs-extra": "*" // A module in npm that adds functionality to the core `fs`
},
"aliases": {
  "fs": "fs-extra", // Use `fs-extra` in place of `fs` implicitly
  "": "./addon-sdk", // Map "" to a directory in the addon. Similar to having local
                    // dependencies in current addons, and this case, performs the same
                    // functionality as "overload-modules"
}
```

Some issue with this is the file system aliases, they lose meaning outside of the developer's machine if not within the current addon directory. For overloading modules, the user would have to explicitly copy the SDK (or sym link) into the current addon. I would like it if 'overloading' modules didn't do anything special, because it's the same functionality as aliases, but maybe a tool to jpm for copying/symlinking and modifying package.json:

```
$ jpm overload ~/Dev/addon-sdk
```

Then adds `~/Dev/addon-sdk` to the current addon in ./addon-sdk, and adds the appropriate `aliases` field for it.
