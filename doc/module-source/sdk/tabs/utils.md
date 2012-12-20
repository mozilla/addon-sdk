


<api name="activateTab">
@function
Set the specified tab as the active, or
[selected](https://developer.mozilla.org/en-US/docs/XUL/tabbrowser#p-selectedTab),
tab.
@param tab {tab}
A [XUL `tab` element](https://developer.mozilla.org/en-US/docs/XUL/tab)
to activate.
@param window {window}
A browser window.
</api>

<api name="getTabBrowser">
@function
Get the [`tabbrowser`](https://developer.mozilla.org/en-US/docs/XUL/tabbrowser)
element for the given browser window.
@param window {window}
A browser window.
@returns {tabbrowser}
</api>

<api name="getTabContainer">
@function
Get the `tabbrowser`'s
[`tabContainer`](https://developer.mozilla.org/en-US/docs/XUL/tabbrowser#p-tabContainer)
property.
@param window {window}
A browser window.
@returns {tabContainer}
</api>

<api name="getTabs">
@function
Returns the tabs for the specified `window`, or the tabs
across all the browser's windows if `window` is omitted.
@param window {nsIWindow}
Optional.
@returns {Array}
An array of [`tab`](https://developer.mozilla.org/en-US/docs/XUL/tab)
instances.
</api>

<api name="getActiveTab">
@function
Given a browser window, get the active, or
[selected](https://developer.mozilla.org/en-US/docs/XUL/tabbrowser#p-selectedTab),
tab.
@param window {window}
A browser window.
@returns {tab}
The currently selected
[`tab`](https://developer.mozilla.org/en-US/docs/XUL/tab).
</api>

<api name="getOwnerWindow">
@function
Get the window that owns the specified tab.
</api>

<api name="openTab">
@function
</api>

<api name="isTabOpen">
@function
</api>

<api name="closeTab">
@function
</api>

<api name="getURI">
@function
</api>

<api name="getTabBrowserForTab">
@function
</api>

<api name="getBrowserForTab">
@function
</api>

<api name="getTabTitle">
@function
</api>

<api name="setTabTitle">
@function
</api>

<api name="getTabContentWindow">
@function
</api>

<api name="getAllTabContentWindows">
@function
</api>

<api name="getTabForContentWindow">
@function
</api>

<api name="getTabURL">
@function
</api>

<api name="setTabURL">
@function
</api>

<api name="getTabContentType">
@function
</api>

<api name="getSelectedTab">
@function
</api>

