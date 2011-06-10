# The Program ID #

The Program ID is a unique identifier for your add-on and is used for a variety
of purposes. For example: [addons.mozilla.org](http://addons.mozilla.org) uses
it to distinguish between new add-ons and updates to existing add-ons, and the
[`simple-storage`](packages/addon-kit/docs/simple-storage.html) module uses it
to figure out which stored data belongs to which add-on.

The program ID is a randomly-generated string, embedded in `package.json` as
the `id` property. If your `package.json` does not already have an `id` when
you run `cfx xpi`, it will generate one for you and then ask you to run `cfx
xpi` again.
