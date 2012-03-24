<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

<!-- contributed by Myk Melez [myk@mozilla.org]  -->
<!-- contributed by Daniel Aquino [mr.danielaquino@gmail.com]  -->
<!-- contributed by Atul Varma [atul@mozilla.com]  -->
<!-- edited by Noelle Murata [fiveinchpixie@gmail.com]  -->

The `preferences-service` module provides access to the
application-wide preferences service singleton.


<api name="set">
@function
Sets the application preference `name` to `value`.
@param name {string} Preference name.
@param value {string,number,bool} Preference value.

**Example:**

    var name = "extensions.checkCompatibility.nightly";
    require("preferences-service").set(name, false);
</api>


<api name="get">
@function
Gets the application preference `name`.
@param name {string}
@param defaultValue {string,number,bool} Preference value.
@returns {string,number,bool} Preference value, returns a default value if no
preference is set.

**Example:**

    var name = "extensions.checkCompatibility.nightly";
    var nightlyCompatChk = require("preferences-service").get(name);
</api>


<api name="has">
@function
@param name {string} Preference name.
@returns {bool} Returns whether or not the application preference `name` exists.

**Example:**

    var name = "extensions.checkCompatibility.nightly";
    if (require("preferences-service").has(name)) {
      // ...
    }
</api>


<api name="isSet">
@function
@param name {string} Preference name.
@returns {bool}
Returns whether or not the application preference `name` both exists
and has been set to a non-default value by the user (or a program
acting on the user's behalf).

**Example:**

    var name = "extensions.checkCompatibility.nightly";
    if (require("preferences-service").isSet(name)) {
      // ...
    }
</api>


<api name="reset">
@function
Clears a non-default, user-set value from the application preference
`name`. If no user-set value is defined on `name`, the function
does nothing. If no default value exists the preference will cease to exist.
@param name {string} Preference name.

**Example:**

    var name = "extensions.checkCompatibility.nightly";
    require("preferences-service").reset(name);
</api>

<api name="getLocalized">
@function
Gets the localized value for an application preference `name`.
@param name {string}
@param defaultValue {string} Preference value.
@returns {string} Localized preference value, returns a default value if no
preference is set. Some preferences refer to a properties file.
So that `prefs.get` returns the properties file URL whereas
`prefs.getLocalized` returns the value defined in the properties file.

**Example:**

    var prefs = require("preferences-service");
    var name = "general.useragent.locale";
    prefs.get(name); // is equal to "chrome://global/locale/intl.properties"
    prefs.getLocalized(name) // is equal to "en-US"

</api>

<api name="setLocalized">
@function
Sets the localized application preference `name` to `value`.
@param name {string} Preference name.
@param value {string} Preference value, a URL to a properties file

**Example:**

    require("preferences-service").set("general.useragent.locale",
                                       "chrome://global/locale/intl.properties");

</api>
