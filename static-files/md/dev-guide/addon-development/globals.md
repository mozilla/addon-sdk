# Globals #
<br>
## JavaScript Globals ##

By default, all code is executed as [JavaScript 1.8.1][] and has access
to all the globals defined by it, such as `Math`, `Array`, and `JSON`. Each
module has its own set of these objects; this means that if, for
instance, the `String` prototype is changed in one module, the changes
will not be reflected in another module.

<span class="aside">
For an introduction to CommonJS modules, see the
[CommonJS](dev-guide/addon-development/commonjs.html) page.
</span>

[JavaScript 1.8.1]: https://developer.mozilla.org/En/New_in_JavaScript_1.8.1

## CommonJS Globals ##

Code has access to the `require` and `exports` globals
as specified by version 1.0 of the [CommonJS Module Specification][].
In addition, `define` from the [CommonJS Asynchronous Module Proposal][]
is available.

[CommonJS Module Specification]: http://wiki.commonjs.org/wiki/Modules/1.0
[CommonJS Asynchronous Module Proposal]: http://wiki.commonjs.org/wiki/Modules/AsynchronousDefinition


## HTML5 Globals ##

Add-on code does *not* have access to any globals defined by the
[HTML5](http://dev.w3.org/html5/spec/Overview.html) specification, such as
`window`, `document`, or `localStorage`. You can access the DOM for a page
by executing a [content script](dev-guide/addon-development/web-content.html)
in the context of the page.

## SDK Globals ##

These globals are available regardless of the security context of the code.

### console ###

The `console` object enables your add-on to log messages. If you have started
the host application for your add-on from the command line (for example, by
executing `cfx run` or `cfx test`) then these messages appear in the command
shell you used. If the add-on has been installed in the host application, then
the messages appear in the host application's
[Error Console](https://developer.mozilla.org/en/Error_Console).

The `console` object has the following methods:

<code>console.**log**(*object*[, *object*, ...])</code>

Logs an informational message to the shell.
Depending on the console's underlying implementation and user interface,
you may be able to introspect into the properties of non-primitive objects
that are logged.

<code>console.**info**(*object*[, *object*, ...])</code>

A synonym for `console.log()`.

<code>console.**warn**(*object*[, *object*, ...])</code>

Logs a warning message.

<code>console.**error**(*object*[, *object*, ...])</code>

Logs an error message.

<code>console.**debug**(*object*[, *object*, ...])</code>

Logs a debug message.

<code>console.**exception**(*exception*)</code>

Logs the given exception instance as an error, outputting information
about the exception's stack traceback if one is available.

<code>console.**trace**()</code>

Logs a stack trace at the point this function is called.

