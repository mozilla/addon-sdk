## Overview

Add-ons often need to interact with content page(s) in order
to enhance browsing experience. There are several common use
cases for such an interactions:

1. Add-on wishes to make modifications to a specific page(s)
by a means of adding DOM Elements, registering event
handlers, while keeping ability to communicate with add-on.

2. Add-on wishes to communicate with a specific page(s) JS
directly, by calling functions defined by it through the
content script.

3. Add-on wishes to expose additional capabilities to a specific
content page(s), resulting in some means of communication
channel between content page(s) and an add-on.

4. More complex add-ons wish to do all of above. In this case
they may wish to let content page(s) not only communicate
with an add-on, but with a content script that does
modification itself.

Note: From the user perspective 1st one 2nd use case are
actually one use case, but for a security concerns we limit
direct  interaction between content script and page script &
there for we distinguish this two use cases.

## Proposal


### Content scripts

In order to address 1st use case add-on's can use "content
scripts". 
*content scripts* execute in a special environment in where they
have access to the DOM of the page they are attached to, but not
the to any JS that's running on a page. Same is true in reverse:
Javascript running on the page cannot access any variables
defined by content scripts.

For example, consider this simple page: 

```html
<html>
  <button id="mybutton">click me</button>
  <script>
    var greeting = "hello, ";
    var button = document.getElementById("mybutton");
    button.person_name = "Bob";
    button.addEventListener("click", function() {
      alert(greeting + button.person_name + ".");
    }, false);
  </script>
</html>
```

Now, suppose following content script was injected into
page above:

```js
var greeting = "hola, ";
var button = document.getElementById("mybutton");
button.person_name = "Roberto";
button.addEventListener("click", function() {
  alert(greeting + button.person_name + ".");
}, false);
```

If `button` is pressed user will see both greetings.

Such setup allows different content script to make changes to its
JavaScript environment without worrying about conflicting with the page
or with other content scripts. For example, a content script could include
JQuery v1 and the page could include JQuery v2, and they wouldn't conflict
with each other.  

In addition content script have additional capabilities, like
cross domain XHR, message channel for communication with add-on host etc.

It's worth noting what happens with JS objects that are shared by the page
and the extension - for example, the `window.onload` event. Assigning to the
object affects your independent copy of the object. For example, both the page
and extension can assign to `window.onload`, but neither one can read the
other's event handler. The event handlers are called in the order in which
they were assigned.

 
### Communication with the page

Although the execution environments of content scripts and the
pages that host them are isolated from each other, they share
access to the page's DOM. If the content script wishes to
communicate with JS on a page it can do so through the shared
DOM.

An example can be accomplished using `window.postMessage`:


```js
addon.port.on("progress", message => {
	window.postMessage({
		from: "content-script",
		type: "progress",
		message: progress
  }, "*")
});
```

```js
window.addEventListener("message", function(event) {
   // If message is from another source, like iframe ignore
   // it.
   if (event.source != window)
	   return;

   if (event.data && event.data.from === "content-script") {
     console.log("received " + event.type + " message from: ",
		 event.data.from,
		 event.data.message);
   }
});
```

In the example above content script establishes communication
with a page through a `postMessage`. In a similar way page can
establish communication with content script.

Although sometimes content script may target pages that does not
necessarily expose desired functionality through such a
communication channel. Such pages can be dealt by injecting
"page scripts" into them. *Page scripts* are scripts that are
executed by an add-on. Unlike content scripts they are executed
in the same page environment as rest of the page JS. Page scripts
are no different from the regular page JS and they are
primarily use case is to establish communication with a page(s)
that was not implemented with that in mind.

### Communication with the add-on

Sometimes add-on may want to expose additional capabilities to a
specific page(s). While that is possible with a help of content
scripts it's would be a lot better to avoid manually pumping
messages back and forth through content scripts. To address this 
use case add-on SDK let's add-ons to communicate directly with content
page(s).

For example consider following page:

```html
<html>
	<button id="mybutton">click me</button>
  <script>
    var button = document.getElementById("mybutton");
		button.addEventListener("click", function(event) {
			var message = MessageEvent("notify", {
    		data: { id: 1, text: "hello world" },
				source: window
			});
			window.dispatchEvent(message);
		});

		window.addEventListener("notifier-click", function(event) {
   		// If message is from another source, like iframe
			// ignore it.
   		if (event.source != window)
	   		return;

			var data = event.data;
   		if (data)
     		console.log("notification #" + data.id + " clicked");
	 });
  </script>
</html>
```

Following add-on code can receive messages from it and send
responses:

```js
const { PagePort } = require("sdk/page-port");
const { notify } = require("sdk/notifications");

const port = PagePort({ include: "*.mypage.com" });
port.on("notify", ({ source, data }) => {
  notify({ text: data.text,
           onClick: () =>
             source.postMessage("notifier-click", { id: data.id })
  });
});
```
