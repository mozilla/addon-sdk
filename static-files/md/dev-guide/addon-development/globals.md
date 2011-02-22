# Globals #
<br>
## JavaScript Globals ##

By default, all code is executed as [JavaScript 1.8.1] and has access
to all the globals defined by it, such as `Math`, `Array`, and `JSON`. Each
module has its own set of these objects; this means that if, for
instance, the `String` prototype is changed in one module, the changes
will not be reflected in another module.

<span class="aside">
For an introduction to CommonJS modules, see the
[CommonJS](dev-guide/addon-development/commonjs.html) page.
</span>

## CommonJS Globals ##

Code has access to the `require` and `exports` globals
as specified by version 1.0 of the [CommonJS Module Specification].
In addition, `define` from the [CommonJS Asynchronous Module Proposal]
is available.

## HTML5 Globals ##

Add-on code does *not* have access to any globals defined by the
[HTML5](http://dev.w3.org/html5/spec/Overview.html) specification, such as
`window`, `document`, or `localStorage`. You can access the DOM for a page
by executing a [content script](dev-guide/addon-development/web-content.html)
in the context of the page.

## SDK Globals ##

These globals are available regardless of the security context of the code.

<code>**console**</code>

`console` is an object with the following methods:

<code>console.**log**(*object*[, *object*, ...])</code>

Logs an informational message to the console. Depending on console's
underlying implementation and user interface, you may be able to
introspect into the properties of non-primitive objects that are
logged.

<code>console.**info**(*object*[, *object*, ...])</code>

A synonym for `console.log()`.

<code>console.**warn**(*object*[, *object*, ...])</code>

Logs a warning message to the console.

<code>console.**error**(*object*[, *object*, ...])</code>

Logs an error message to the console.

<code>console.**debug**(*object*[, *object*, ...])</code>

Logs a debug message to the console.

<code>console.**exception**(*exception*)</code>

Logs the given exception instance as an error, outputting information
about the exception's stack traceback if one is available.

<code>console.**trace**()</code>

Inserts a stack trace into the console at the point this function is called.

