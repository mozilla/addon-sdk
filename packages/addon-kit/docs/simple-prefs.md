<!-- contributed by Erik Vold [erikvvold@gmail.com]  -->

The `simple-prefs` module lets you easily and persistently store preferences
across application restarts, using the Mozilla preferences system.  These
preferences will be configurable by the user in [about:addons](about:addons) and
in [about:config](about:config).

Introduction
------------

With the simple preferences module you can store booleans, integers, and string
values.


<api name="prefs">
@property {object}
  A persistent object private to your add-on.  Properties with boolean,
  number, and string values will be persisted in the Mozilla preferences system.
</api>
