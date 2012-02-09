# Low-Level APIs #

Modules in this section implement low-level APIs. These
modules fall roughly into three categories:

* fundamental utilities such as
[collection](packages/api-utils/docs/collection.html) and
[url](packages/api-utils/docs/url.html). Many add-ons are likely to
want to use modules from this category.

* building blocks for higher level modules, such as
[events](packages/api-utils/docs/events.html),
[worker](packages/api-utils/docs/worker.html), and
[api-utils](packages/api-utils/docs/api-utils.html). You're more
likely to use these if you are building your own modules that
implement new APIs, thus extending the SDK itself.

* privileged modules that expose powerful low-level capabilities
such as [tab-browser](packages/api-utils/docs/tab-browser.html),
[xhr](packages/api-utils/docs/xhr.html), and
[xpcom](packages/api-utils/docs/xpcom.html). You can use these
modules in your add-on if you need to, but should be aware that
the cost of privileged access is the need to take more elaborate
security precautions. In many cases these modules have simpler,
more restricted analogs among the "High-Level APIs" (for
example, [tabs](packages/addon-kit/docs/tabs.html) or
[request](packages/addon-kit/docs/request.html)).

These modules are still in active development, and we expect to
make incompatible changes to them in future releases.