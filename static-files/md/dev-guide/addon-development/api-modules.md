# API Overview #

This section is a very quick overview of some of the APIs provided in the SDK.
We've grouped them into four categories according to their function:

 1. Building a UI
 2. Interacting with the Web
 3. Interacting with the Browser
 4. Dealing with Data

## Building a UI ##

The SDK provides four modules to help you build a UI.

### [panel](packages/addon-kit/docs/panel.html) ###

A panel is a dialog. Its content is specified as HTML and you can execute
scripts in it, so the appearance and behaviour of the panel is limited only
by what you can do using HTML, CSS and JavaScript.

You can build or load the content locally or load it from a remote server.
The screenshot below shows a panel whose content is built from the list of
currently open tabs:

<img class="image-center" src="media/screenshots/modules/panel-tabs-osx.png"
alt="List open tabs panel">
<br>

Scripts executing in the panel's context can exchange messages with the main
add-on code.

### [widget](packages/addon-kit/docs/widget.html) ###

A widget is a small piece of HTML content which is displayed in the Firefox 4
[add-on bar](https://developer.mozilla.org/en/The_add-on_bar).

Widgets are generally used in one of two different contexts:

* to display compact content that should always be visible to the user, such as
the time in a selected time zone or the weather. The screenshot below shows a
widget that displays the time in the selected city:

<img class="image-center" src="media/screenshots/modules/widget-content-osx.png"
alt="Mozilla widget content">
<br>

* to provide a way for the user to access other parts of an add-on's user
interface. For example, a widget might display only an icon, but open a
settings dialog when the user clicks it. The widget below displays only the
Mozilla icon:

<img class="image-center" src="media/screenshots/modules/widget-icon-osx.png"
alt="Mozilla widget icon">
<br>

To simplify your code in the latter case, you can assign a panel object to
your widget. Then when the user clicks the widget, the widget will display
the panel anchored to the widget. The `reddit-panel` example demonstrates this:

<img class="image-center" src="media/screenshots/modules/reddit-panel-osx.png"
alt="Reddit panel">
<br>

### [context-menu](packages/addon-kit/docs/context-menu.html) ###

The `context-menu` module lets you add items and submenus to the browser's
context menu.

You can define the context in which the item is shown using any
of a number of predefined contexts (for example, when some content on the page
is selected) or define your own contexts using scripts.

In the screenshot below an add-on has added a new submenu to the context menu
associated with `img` elements:

<img class="image-center" src="media/screenshots/modules/context-menu-image-osx.png"
alt="Context-menu">
<br>

### [notifications](packages/addon-kit/docs/notifications.html) ###

This module enables an add-on to display transient messages to the user.

It uses the platform's notification service ([Growl](http://growl.info/) on Mac
OS X and Windows, libnotify on Linux), so the notification will look slightly
different on different platforms. On Mac OS X a notification will look
something like this:

<img class="image-center" src="media/screenshots/modules/notification-growl-osx.png"
alt="Growl notification">
<br>

## Interacting with the Web ##

As you might expect, the SDK provides several APIs for interacting with the
Web. Some of them, like `page-mod` and `selection`, interact with web pages
the user visits, while APIs like `page-worker` and `request` enable you to
fetch web content for yourself.

### [page-mod](packages/addon-kit/docs/page-mod.html) ###

The `page-mod` module enables you to execute scripts in the context of selected
web pages, effectively rewriting the pages inside the browser.

You supply a set of scripts to the page-mod and a [`match
pattern`](packages/api-utils/docs/match-pattern.html) which identifies, by URL,
a set of web pages. When the user visits these pages the scripts are attached
and executed.

This is the module you should use if you need to modify web pages or simply to
retrieve content from pages the user visits.

### [selection](packages/addon-kit/docs/selection.html) ###

Using this module your add-on can get and set any selection in the active web
page, either as text or HTML.

### [page-worker](packages/addon-kit/docs/page-worker.html) ###

Using a page worker, an add-on can load a page and access its DOM without
displaying it to the user.

This is the module to use if you want to interact with a page's DOM without
the user's involvement.

### [request](packages/addon-kit/docs/request.html) ###

This module enables you to make network requests from your add-on.

## Interacting with the Browser ##

These APIs enable your add-on to interact with the browser itself.

### [clipboard](packages/addon-kit/docs/clipboard.html) ###

The `clipboard` module enables you to get and set the contents of the system
clipboard.

### [private-browsing](packages/addon-kit/docs/private-browsing.html) ###

`private-browsing` enables your add-on to start and stop private browsing mode,
and to be notified when the browser starts or stops private browsing
mode.

You should use these notifications to ensure your add-on respects private
browsing.

### [tabs](packages/addon-kit/docs/tabs.html) ###

This module enables you to interact with the currently open tabs and to open
new tabs.

You can get the list of open tabs and the current active tab, and get
notified of tabs opening and closing, or becoming active and inactive.

You can retrieve each tab and get certain information about it such as its URL.

Note that you can't access the content hosted by the tab using this API: if you
want to do this, use the [`page-mod`](packages/addon-kit/docs/page-mod.html) API.

### [windows](packages/addon-kit/docs/windows.html) ###

Like the `tabs` module, but for windows: this module enables you to
interact with currently open windows and to open new windows.

You can get the list of open windows, the current active window, and get
notified of windows opening and closing, or becoming active and inactive.

You can retrieve each window and get certain information about it such as the
list of tabs it hosts.

Again: you can't access the content hosted by the window using this API, and if
you want to do this use the [`page-mod`](packages/addon-kit/docs/page-mod.html)
API.

## Dealing with Data ##

### [simple-storage](packages/addon-kit/docs/simple-storage.html) ###

This module provides your add-on with persistent storage.

### [self](packages/api-utils/docs/self.html) ###

Using this module you can access any files you have included in your add-on's
`data` directory.

For example: if your add-on uses [content
scripts](dev-guide/addon-development/web-content.html) and you have chosen to
supply them as separate files, you use `self` to retrieve them. Similarly, if
your add-on includes an icon or some HTML content to display in a
[`panel`](packages/addon-kit/docs/panel.html) you can store the files in your
`data` directory and retrieve them using `self`.

This module also gives your add-on access to its [Program
ID](dev-guide/addon-development/program-id.html).

Note that this module is in the
[`api-utils`](packages/api-utils/api-utils.html) package.
