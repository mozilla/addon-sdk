> _This JEP was implemented in [Bug 787346](https://bugzilla.mozilla.org/show_bug.cgi?id=787346)_

Once SDK will go [packageless][] it's tree will need to be restructured
appropriately. Since SDK will no longer have  **packages** directory
with that name will have to go away and all the modules under it will
have to move into `lib/` folder instead. 

# Goals

- Tree must reflect difference between:
  - High level API modules
  - Internal modules
  - Toolkit modules
- Must be easy to map layout to mozilla-central
  (see [SDK in Firefox](./JEP-SDK-in-Firefox) for more details)

# Proposal

All modules targeting **toolkit** will be located into `lib/toolkit` to
feel natural when requiring `require('toolkit/promise')`. Only high level
API modules can live under `lib/` folder so that they are more accessible
by a consumers. All low level APIs will have to move under some directory
in the `lib/` so that they won't work when with single term require call
`require('foo')` stressing the fact that they are internal modules.

After [described changes][pull request] tree will end up as follows:

```sh
lib
├── addon
│   ├── installer.js
│   ├── loader.js
│   └── runner.js
├── addon-page.js
├── base64.js
├── clipboard.js
├── console
│   └── plain-text.js
├── content
│   ├── content-proxy.js
│   ├── content-worker.js
│   ├── loader.js
│   ├── symbiont.js
│   └── worker.js
├── context-menu.js
├── core
│   ├── array.js
│   ├── functional.js
│   ├── heritage.js
│   ├── object.js
│   ├── timers.js
│   ├── type.js
│   └── uuid.js
├── deprecated
│   ├── api-utils.js
│   ├── collection.js
│   ├── cortex.js
│   ├── errors.js
│   ├── events
│   │   └── assembler.js
│   ├── events.js
│   ├── hidden-frame.js
│   ├── light-traits.js
│   ├── list.js
│   ├── observer-service.js
│   ├── registry.js
│   ├── tab-browser.js
│   ├── traits
│   │   └── core.js
│   ├── traits.js
│   ├── unload.js
│   └── window-utils.js
├── dom
│   ├── events
│   │   └── keys.js
│   └── events.js
├── error
│   └── traceback.js
├── event
│   ├── core.js
│   └── target.js
├── frame
│   └── utils.js
├── hotkeys.js
├── image
│   └── thumbnail.js
├── io
│   ├── byte-streams.js
│   ├── file.js
│   ├── httpd.js
│   ├── text-streams.js
│   └── xhr.js
├── keyboard
│   ├── hotkeys.js
│   ├── observer.js
│   └── utils.js
├── l10n
│   ├── bundle.js
│   ├── core.js
│   ├── html.js
│   ├── locale.js
│   └── plural-rules.js
├── l10n.js
├── loader
│   ├── globals.js
│   └── sandbox.js
├── match-pattern.js
├── notifications.js
├── page-mod.js
├── page-worker.js
├── panel.js
├── password
│   └── utils.js
├── passwords.js
├── preference
│   └── core.js
├── private-browsing.js
├── request.js
├── selection.js
├── self.js
├── simple-prefs.js
├── simple-storage.js
├── system
│   ├── environment.js
│   ├── events.js
│   ├── memory.js
│   ├── runtime.js
│   └── xul-app.js
├── system.js
├── tab
│   ├── events.js
│   ├── observer.js
│   ├── tab.js
│   └── utils.js
├── tabs.js
├── test
│   ├── assert.js
│   ├── finder.js
│   ├── harness.js
│   ├── loader.js
│   ├── runner.js
│   ├── unit.js
│   └── utils
│       └── tmp-file.js
├── test.js
├── timers.js
├── toolkit
│   ├── loader.js
│   ├── namespace.js
│   └── promise.js
├── uri
│   ├── data.js
│   ├── querystring.js
│   └── url.js
├── widget.js
├── window
│   ├── dom.js
│   ├── loader.js
│   ├── observer.js
│   ├── tabs.js
│   └── utils.js
├── windows.js
└── xpcom
    └── core.js

27 directories, 108 files
```

# Issues

- Low level modules will still have to be required as
  `require('sdk/core/heritage')` instead of
  `require('core/heritage')` since all SDK modules will
  be located in a single place in a tree. This makes
  layout little awkward.

# Discussion

https://etherpad.mozilla.org/JEP-lib
[pull request]:https://github.com/mozilla/addon-sdk/pull/455
[packageless]:https://github.com/mozilla/addon-sdk/wiki/JEP-packageless
