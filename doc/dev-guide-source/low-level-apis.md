<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

# Low-Level APIs #

Modules in this section implement low-level APIs. These
modules fall roughly into three categories:

* fundamental utilities such as
[collection](packages/api-utils/collection.html) and
[url](packages/api-utils/url.html). Many add-ons are likely to
want to use modules from this category.

* building blocks for higher level modules, such as
[events](packages/api-utils/events.html),
[worker](packages/api-utils/content/worker.html), and
[api-utils](packages/api-utils/api-utils.html). You're more
likely to use these if you are building your own modules that
implement new APIs, thus extending the SDK itself.

* privileged modules that expose powerful low-level capabilities
such as [tab-browser](packages/api-utils/tab-browser.html),
[xhr](packages/api-utils/xhr.html), and
[xpcom](packages/api-utils/xpcom.html). You can use these
modules in your add-on if you need to, but should be aware that
the cost of privileged access is the need to take more elaborate
security precautions. In many cases these modules have simpler,
more restricted analogs among the "High-Level APIs" (for
example, [tabs](packages/addon-kit/tabs.html) or
[request](packages/addon-kit/request.html)).

These modules are still in active development, and we expect to
make incompatible changes to them in future releases.