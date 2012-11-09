# SDK API Lifecycle #

Developers using the SDK's APIs need to know how far they can trust that
a given API will not change in future releases. At the same time, developers
maintaining and extending the SDKs APIs need to be able to introduce new
APIs that aren't yet fully proven, and to retire old APIs when they're
no longer optimal or supported by the underlying platform.

The API lifecycle aims to balance these competing demands. It has two
main components:

* a [stability index](dev-guide/guides/stability.html#Stability Index)
that defines how stable each module is
* a [deprecation process](dev-guide/guides/stability.html#Deprecation Process)
that is intended to enable the SDK to remove or change APIs when necessary,
while giving developers enough time to update their code.

## Stability Index ##

The stability index is adopted from
[node.js](http://nodejs.org/api/documentation.html#documentation_stability_index).
The SDK uses only three of the six values defined by node.js:

<table>
  <tr>
    <td>Experimental</td>
    <td>The module is not yet stabilized.
You can try it out and provide feedback, but we may change or remove
it in future versions without having to pass through a formal
deprecation process.</td>
  </tr>
  <tr>
    <td>Stable</td>
    <td>The module is a fully-supported part of
the SDK. We will avoid breaking backwards compatibility unless absolutely
necessary. If we do have to make backwards-incompatible changes, we will
go through the formal deprecation process.</td>
  </tr>
  <tr>
    <td>Deprecated</td>
    <td>We plan to change this module, and backwards compatibility
should not be expected. Don’t start using it, and plan to migrate away from
this module to its replacement.</td>
  </tr>
</table>

The stability index for each module is written into that module’s
metadata structure, and is displayed at the top of each module's
documentation page.

## Deprecation Process ##

### Preparation ###

Before deprecating a module, the SDK team will develop and document
an alternative, and decide which release to deprecate it in.

### Deprecation ###

In the chosen release, the SDK team will communicate the module's deprecation:

* update the module's stability index to be "deprecated"
* include a deprecation notice in the release notes,
https://blog.mozilla.org/addons/, and mailing list. The deprecation
notice should point developers at a migration guide.

### Migration ###

The deprecation period defaults to 18 weeks. During this time, the
module will be in the deprecated state. The SDK team will track usage
of deprecated modules on addons.mozilla.org and support developers
migrating their code. The SDK will continue to provide warnings:

* CFX will generate warnings when developers use deprecated modules.
* API documentation will warn users about that the module is deprecated,
which release is expected to remove it, and how to migrate.
* Attempts to use a deprecated module at runtime will log an error to
the error console.
* The AMO validator will throw errors when deprecated modules are used,
and these add-ons will therefore fail AMO review.

All warnings should include links to further information about what to
use instead of the deprecated module and when the module will be completely
removed.

### Removal ###

The target removal date is 18 weeks after deprecation. In preparation for
this date the SDK team will decide whether to go ahead with removal: this
will depend on how many developers have successfully migrated from the
deprecated module.

If it's OK to remove the module, it will be removed. The SDK team will
remove the corresponding documentation, and communicate the removal in
the usual ways: the release notes,  https://blog.mozilla.org/addons/,
and the Jetpack mailing list.

If it's not OK to remove it, the team will continue to support migration
and target the next release.
