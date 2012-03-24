<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

<!-- contributed by Erik Vold [erikvvold@gmail.com]  -->

#### *Experimental*

The `simple-prefs` module lets you easily and persistently store preferences
across application restarts, which can be configured by users in the
Add-ons Manager.

Introduction
------------

With the simple preferences module you can store booleans, integers, and string
values.


Inline Options & Default Values
-------------------------------

In order to have a `options.xul` (for inline options) generated, or a
`defaults/preferences/prefs.js` for default preferences, you will need to
define the preferences in your `package.json`, like so:

    {
        "fullName": "Example Add-on",
        ...
        "preferences": [{
            "name": "somePreference",
            "title": "Some preference title",
            "description": "Some short description for the preference",
            "type": "string",
            "value": "this is the default string value"
        }]
    }


<api name="prefs">
@property {object}
  *experimental* A persistent object private to your add-on.  Properties with boolean,
  number, and string values will be persisted in the Mozilla preferences system.
</api>


<api name="on">
@function
  *experimental* Registers an event `listener` that will be called when a preference is changed.

**Example:**

    function onPrefChange(prefName) {
        console.log("The " + prefName + " preference changed.");
    }
    require("simple-prefs").on("somePreference", onPrefChange);
    require("simple-prefs").on("someOtherPreference", onPrefChange);


@param prefName {String}
  The name of the preference to watch for changes.
@param listener {Function}
  The listener function that processes the event.
</api>

<api name="removeListener">
@function
  *experimental* Unregisters an event `listener` for the specified preference.

@param prefName {String}
  The name of the preference to watch for changes.
@param listener {Function}
  The listener function that processes the event.
</api>

