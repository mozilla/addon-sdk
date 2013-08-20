# Integrating Addon-sdk with Firefox

This document outlines process of landing core parts of Add-on SDK to mozilla-central to be shipped with the rest of the Firefox.

See: [Bug 731779]

## Development process

One of the core goals is to preserve current development ergonomics and maybe share those with other teams. This means following:

- Canonical repository remains on github.
- Code can be contributed via pull requests or patches in bugzilla.
- Changes to SDK modules should not require building Firefox to test.  

### Sync addon-sdk code with mozilla central

Once a week the code in the [addon-sdk git repository's] master branch will be merged to a special **integration** branch using the --no-ff flag to ensure that a merge commit is created. After that the branch will be pulled into the **toolkit/addon-sdk** directory of a clone of mozilla-central and committed. This can then be pushed to mozilla-central for tests to run on tinderbox.

See: [Bug 793916]

Appropriate make files will incorporate SDK modules from mozilla-central's **toolkit/addon-sdk** folder into Firefox builds.

See: [Bug 793928]

Once the code is in mozilla-central it will ride the trains until release.

### Backouts from mozilla-central

If the uplift to mozilla-central has to be backed out then this change will be pulled to the clone, committed to the **integration** branch and then merged to the **master** branch and pushed back to the [addon-sdk git repository]. This keeps the two trees in sync and means changes must be re-landed on the **master** branch after being fixed to get back to mozilla-central during the next uplift.

### Reverts in addon-sdk master branch

Changes that cause cause test failures ( anything but green ) will be reverted to make sure that the **integration** branch is always green.

### Breaking issues discovered on mozilla-aurora or mozilla-beta

In the event that a breaking issue is discovered that must be fixed on aurora, beta or esr branches the Jetpack team will be responsible for creating a patch that applies there and requesting approval to land it in mercurial.

### File layout changes

SDK module layout and packaging will be changed to reflect the one used in Firefox. More details on this subject are described under [JEP lib](https://github.com/mozilla/addon-sdk/wiki/JEP-lib)

See: [Bug 787346]

### CFX changes

The CFX tool needs to be updated to add compatibility with a new module layout described above.

See: [Bug 793924]

CFX also will have to recognize modules shipped with a firefox and create appropriate entries in generated manifest file.

See: [Bug 793925]

### Add-on builder changes

Incompatible changes will be made to CFX to support SDK integration with firefox. Add-on builder will need to incorporate those CFX changes to remain compatible with new versions of SDK.

See: [Bug 793932]

Build UI and parts of the backend will need have to change to reflect the fact that modules are shipped with firefox.

See: [Bug 793934]

### Document generation

Documentation generator will need to recognize new file layout and how these files map to the modules in the firefox.

See: [Bug 793926]

## Contributions

Any changes to the SDK codebase will go through standard review process. Contributor will have an option either submitting a pull request against [addon-sdk repo] or submitting a patch against addon-sdk or mozilla-central repos in bugzilla. Since mozilla-central will contain complete addon-sdk repo patches will remain compatible.

## Testing

The Add-on SDK test harness will be included in the uplift to mozilla-central so it will be necessary to make sure that tinderbox can run it.

See: [Bug 793921]

In order to keep mozilla-central as green as possible we may push to try before pushing and then may use mozilla-inbound as the main repository instead of mozilla-central.

We already have a system in place for running Add-on SDK tests against Firefox for every checkin to the [addon-sdk repository], this should remain active so we know whether the current code can be uplifted.

## Development

Loader will have to recognise special `sdk.local.path` preference. If such preference is set, loader will use specified location for leading modules instead of `resource:///modules/commonjs/`.

This will enable faster iterations over the SDK codebase once the loader and the sdk are integrated into Firefox.

See: [Bug 793912]

 

[addon-sdk repo]:https://github.com/mozilla/addon-sdk
[Bug 793912]:https://bugzilla.mozilla.org/show_bug.cgi?id=793912
[Bug 731779]:https://bugzilla.mozilla.org/show_bug.cgi?id=731779
[Bug 793916]:https://bugzilla.mozilla.org/show_bug.cgi?id=793916
[Bug 793921]:https://bugzilla.mozilla.org/show_bug.cgi?id=793921
[Bug 787346]:https://bugzilla.mozilla.org/show_bug.cgi?id=787346
[Bug 793924]:https://bugzilla.mozilla.org/show_bug.cgi?id=793924
[Bug 793925]:https://bugzilla.mozilla.org/show_bug.cgi?id=793925
[Bug 793926]:https://bugzilla.mozilla.org/show_bug.cgi?id=793926
[Bug 793928]:https://bugzilla.mozilla.org/show_bug.cgi?id=793928
[Bug 793932]:https://bugzilla.mozilla.org/show_bug.cgi?id=793932
[Bug 793934]:https://bugzilla.mozilla.org/show_bug.cgi?id=793934