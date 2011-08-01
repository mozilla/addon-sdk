# Internals > Globals #

Globals in this section are subject to change in the future and/or are likely
to be of interest to SDK module developers, rather than add-on developers.

## Components ##

To access the infamous and powerful `Components` object, see the
[Chrome Authority](dev-guide/module-development/chrome.html) documentation.

## \_\_url\_\_ ##

The `__url__` global is a string identifying the URL from which the code has
been retrieved.  If the code has no identifiable URL, this value may be `null`.

## packaging ##

<span class="aside">
For more information on packaging, see the [Package Specification][] appendix.
</span>

The `packaging` global contains methods and metadata related to
the packages available in the current environment.

<code>packaging.**getURLForData**(*path*)</code>

Given a unix-style path relative to the calling package's `data`
directory, returns an absolute URL to the file or directory.

By "calling package", we mean the package in which the caller's source
code resides.

Thus, for example, if a package contains a resource at
`data/mydata.dat` and a module at `lib/foo.js`, the module at
`lib/foo.js` may make the following call to retrieve an absolute URL
to `data/mydata.dat`:

    var myDataURL = packaging.getURLForData("/mydata.dat");

If the calling package has no `data` directory, an exception is
thrown.

## memory ##

`memory` is an object that exposes functionality to track
objects of interest and help diagnose and prevent memory leaks.

<code>memory.**track**(*object*, [*bin*])</code>

Marks *object* for being tracked, and categorizes it with the given
bin name. If *bin* isn't specified, the memory tracker attempts to
infer a bin name by first checking the object's
`constructor.name`; if that fails or results in the generic
`Object`, the stack is inspected and the name of the current
function being executed&mdash;which is assumed to be a constructor
function&mdash;is used. If that fails, then the object is placed in a
bin named `generic`.

<code>memory.**getObjects**([*bin*])</code>

Returns an `Array` containing information about tracked objects
that have been categorized with the given bin name. If *bin* isn't
provided, information about all live tracked objects are returned.

Each element of the array is an object with the following keys:

<table>
  <tr>
    <td><code>weakref</code></td>
    <td>A weak reference to the object being tracked. Call
    <code>get()</code> on this object to retrieve its strong reference; if
    a strong reference to the object no longer exists, <code>get()</code>
    will return <code>null</code>.</td>
  </tr>
  <tr>
    <td><code>created</code></td>
    <td>A <code>Date</code> representing the date and time that
    <code>memory.track()</code> was called on the object being
    tracked.</td>
  </tr>
  <tr>
    <td><code>filename</code></td>
    <td>The name of the file that called <code>memory.track()</code> on
    the object being tracked.</td>
  </tr>
  <tr>
    <td><code>lineNo</code></td>
    <td>The line number of the file that called
    <code>memory.track()</code> on the object being tracked.</td>
  </tr>
</table>

<code>memory.**getBins**()</code>

Returns an `Array` containing the names of all bins that aren't
currently empty.

  [Package Specification]: dev-guide/addon-development/package-spec.html