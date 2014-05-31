# Flags

##Overview

Flags would be an SDK module which allows addon developers to slightly modify devtools components. It would work by swapping flags passed to the components on instantiation for developer-supplied flags.

##Motivation
There are a number of factors which motivate this design:

* The devtools components are very large and touch lots of objects that shouldn't be exposed to addon developers directly (without sandboxing). By limiting addon developers' interaction with devtools components to set flags, we both simplify the components (from the developer's perspective) and limit the developer's control.
* Swapping startup flags is a very light-weight way to modify devtools components. It requires little addon-sdk code. Because of this, power users familiar with the devtools components can user their knowledge when building addons.
* Flags can be used to build higher-level APIs which less experienced developers can use in simpler addons.

##Implementation

* SDK elements will register flags with `gDevTools` for given devtools components. When a component for which flags are registered is instantiated, `gDevTools` will swap in user-supplied flags for the flags that would otherwise be used in the instantiation.
* Components which can be targets for flags must be slightly modified to poll `gDevTools` on startup.

##Usage Example
See an example using the "webconsole-variables-view-controller" component [here](https://github.com/cbrem/addon-sdk/blob/bug980555_v1/examples/public-fields/lib/main.js). This example operates by replacing the `VariablesViewController`'s `getObjectClient` flag with a user-supplied flag which:

1. Calls the default `getObjectClient` method to get an object client.
2. Overrides the object client's `getPrototypeAndProperties` method (the one that the `VariablesView` uses to populate itself) so that the prototype and properites that it returns do not include any fields that begin with an underscore.

Now, whenever the `VariablesView` popluates itself from an object client, it will not see the client's any of the clients "private" fields.

This process is a bit cumbersome, and proxying `getPrototypeAndProperties` to hide or modify properties seems like a common use case. Therefore, a high-level API might include ways to make this process easier.
