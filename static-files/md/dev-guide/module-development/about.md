# Internals Guide #

The Internals Guide explains how to use the low-level modules provided
by the SDK to build your own modules which implement new APIs for add-on code
to use, thus extending the SDK itself.

The features and APIs in the Internals guide, and the guide itself,
are still in active development, and we expect to make incompatible changes to
them in future releases.

### [Programming Guides](dev-guide/module-development/guides.html) ###
Documents some
of the considerations involved in using the low-level modules. In particular,
it contains important information for people developing modules which require
privileged access to browser objects such as the chrome.

### [Reference](dev-guide/module-development/reference.html) ###
Detailed documentation for the low-level modules which you can use as building
blocks for your own modules. In particular, it contains modules that supply
basic services, like messaging, for higher-level modules. Many of these modules
require privileged access to the browser chrome.
