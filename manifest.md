# package.json

Below is a table of fields supported by the current cfx, node.js package.json format, and plans for support in the new jpm.

* :white_check_mark: this property is supported
* :x: this is not supported
* :o: this property will be supported as a fallback and should be considered deprecated
* :warning: this property works differently than other or previous implementations, noted in detail below.
* :grey_question: is asking, "Should we support this property?"

There are also additional fields used in node.js that can be helpful for those who share addon code, but not something we necessarily have to account for ("bugs", "repository") in AOM, so these will not be listed, and node-only fields will also not be listed.

Also listed are [chrome's manifest](http://developer.chrome.com/extensions/manifest.html) fields.


| field        | cfx              | node             | jpm             | chrome |
|--------------|------------------|------------------|-----------------|--------|
|name          |:white_check_mark:|:white_check_mark:|:white_check_mark:
|fullName      |:white_check_mark:|:x:               |:o:             
|title         |:white_check_mark:|:x:               |:white_check_mark:
|description   |:white_check_mark:|:white_check_mark:|:white_check_mark:
|main          |:white_check_mark:|:white_check_mark:|:white_check_mark:
|version       |:white_check_mark:|:white_check_mark:|:white_check_mark:
|author        |:white_check_mark:|:white_check_mark:|:white_check_mark:
|contributors  |:white_check_mark:|:white_check_mark:|:white_check_mark:
|translators   |:white_check_mark:|:x:               |:white_check_mark:
|license       |:white_check_mark:|:white_check_mark:|:white_check_mark:
|homepage      |:white_check_mark:|:white_check_mark:|:white_check_mark:
|dependencies  |:warning:         |:white_check_mark:|:white_check_mark:
|packages      |:white_check_mark:|:x:               |:x:
|harnessClassID|:white_check_mark:|:x:               |:x:
|icon          |:white_check_mark:|:x:               |:white_check_mark:
|icon64        |:white_check_mark:|:x:               |:white_check_mark:
|id            |:white_check_mark:|:x:               |:white_check_mark:
|lib           |:white_check_mark:|:x:               |:x:
|engines       |:x:               |:white_check_mark:|:white_check_mark:
|[engineStrict](https://npmjs.org/doc/json.html#engineStrict)  |:x:               |:white_check_mark:|:grey_question:
|permissions   |:white_check_mark:|:x:               |:white_check_mark:
|preferences   |:white_check_mark:|:x:               |:white_check_mark:
|tests         |:white_check_mark:|:x:               |:white_check_mark: :grey_question:
|aliases       |:x:               |:x:               |:white_check_mark:
|unpack        |:white_check_mark:|:x:               |:white_check_mark:
|updateURL     |:white_check_mark:|:x:               |:white_check_mark:
|updateKey     |:white_check_mark:|:x:               |:white_check_mark:
|aboutURL      |:white_check_mark:|:x:               |:white_check_mark:
|strictCompatability|:white_check_mark:|:x:               |:white_check_mark:

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
