<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

The `deprecate` module provides helper functions to deprecate code.

<api name="deprecateFunction">
@function
  Dump on console the error given, with `"DEPRECATED:"` as prefix, and print the
  stacktrace; then execute the function passed as first argument and returns its
  value.

  Notice it doesn't raise an exception, but just display an error message,
  therefore the code won't stop from being executed.

  This function is mostly used for deprecated functionalities that are still
  available but in the process to be removed in the future.

@param fun {function}
  The function to execute after the error message
@param msg {string}
  The error message to display

@returns {*} The returned value from `fun`
</api>

<api name="deprecateUsage">
@function
  Dump on console the error given, with `"DEPRECATED:"` as prefix, and print the
  stacktrace.

  Notice it doesn't raise an exception, but just display an error message,
  therefore the code won't stop from being executed.

  This function is mostly used to deprecated functionalities that are not
  available anymore.

@param msg {string}
  The error message to display
</api>
