# (Note: This high-level API is out-of-date. It depends on the low-level API described in Flags.md. It will be updated when the low-level API is finalized.)

# Object Inspectors

## Overview

The default VariablesView is great for displaying most JS objects when users click on them from the console. However, addon developers may want to modify the way that it displays objects. The Object Inspectors SDK extension will allow developers to do just this. Specifically, the Object Inspectors extension will let addons:

* Apply filters/wrappers to objects before passing them to the default Object Inspector.
* Replace the default Object Inspector with a custom Object Inspector of their own design (see "Possible Future Goals").
* Place one or more custom Object Inspectors in tabs alongside the default Object Inspector (see "Possible Future Goals").

## Use Cases

Use cases/patterns for these SDK feature include:

* Change an object's representation in an Object Inspector:

	* Small modifications which retain the default Object Inspector's tree structure. For example:

		* Hide private fields
		* LinkedList (example below)
		* Represent objects from compile-to-JS lanuages or JS frameworks in more intuitive formats

	* Larger modifications which do not retain the default Object Inspector's tree structure.

		* Would require "User-Defined Object Inspecter Views" in "Possible Future Goals".
		* For example, render nodes and edges for objects tagged as graphs.

* Object inspection side-effects:

	* Take additional actions on page when an object is opened for inspection.
	* For example, alert users when they try to set one a field of the object under inspection to an illegal value.

* Reactive object inspectors:

	* Force an object inspector to update more freqently/in response to more events than it normally would.
	* For example, update the inspector whenever the underlying object changes, not just when it's clicked in the console.

## Implementation

### API

* ProxyRule

		/*
		 * A `ProxyRule` must contain two options: `filter` and `proxy`.
		 *
		 * `filter` behaves similarly to a functional filter, and `proxy`
		 * behaves similarly to a functional map. Given a simplified object
		 * grip client (the interface for such grips is) defined below),
		 * `filter` returns a promise. If the promise resolves, then `proxy` is
		 * applied to the client before it is passed to the VariablesView.
		 * If the promise rejects, then the client is passed to the
		 * VariablesView without modification.
		 *
		 * The object passed to `filter` and `proxy` implements a simplified
		 * object grip client interface. The result of `proxy` must implement
		 * the same interface. The interface contains the methods:
		 *
		 *  - `prototypeAndProperties`: Returns a promise which resolves to
		 *  an object with two fields: `prototype` and `properties`. These
		 *  are the prototype and properties that will be displayed in the
		 *  VariablesView.
		 *
		 *  - `changeValue`: Given an object containing `key` and `newValue`
		 *  fields, returns a promise that resolves when it has finished
		 *  changing that value on the client or rejects if that value cannot
		 *  be changed.
		 *
		 *  - `changeKey`: Given an object containing `key` and `newKey`
		 *  fields, returns a promise that resolves when it has finished
		 *  changing that key on the client or rejects if that key cannot be
		 *  changed.
		 *
		 *  - `deleteKey`: Given an object containing a `key` field, returns
		 *  a promise when resolves when that key has been deleted on the
		 *  client or rejects if the key cannot be deleted.
		 */
		ProxyRule({filter, proxy})

		/*
		 * Enable or disable the proxying of objects caught by this rule's
		 * filter.
		 */
		enable()
		disable()

### Usage Example

Object Inspectors can be used to create a convenient viewer for linked lists. Consider a `LinkedList` implementation like this:

	/*
	 * An element in a `LinkedList`.
	 *
	 * @param value Object The value in this `Node`.
	 * @param next Node The next `Node` in the `LinkedList`.
	 */
	function Node(value, next) {
		this._LinkedList = "dummy";
		this.value = value;
		this.next = next;
	}

	/*
	 * An ordered collection of `Nodes`.
	 */
	function LinkedList() {
		/*
		 * The first element of the `LinkedList`.
		 * @type Node
		 */
		this.head = null;
	}

In an addon, we can create a `ProxyRule` that identifies `LinkedList` objects and proxies them before passing them to the VariablesView.. The addon's `main.js` could look something like this:

	const inspectors = require('sdk/dev/object-inspectors');
	const linkedList = require('./linked-list.js');

	let linkedListRule = new inspectors.ProxyRule({
		filter: client => client.properties().then({properties} => "_LinkedList" in properties),
		proxy: client => new LinkedListClient(client)
	});

	function LinkedListClient(client) {
		this._client = client;
	}

	LinkedListClient.prototype = {
		prototypeAndProperties: () => {
			let deferred = promise.defer();

			((client, list) => {
				client.properties().then({properties} => {
					if (properties.next) {
						_properties(properties.next, list.concat(properties["value"]));
					} else {
						deferred.resolve({
							properties: list,
							prototype: this._client.prototype
						});
					}
				});
			}) (this._client, []);

			return deferred.promise;
		},
		changeValue: {key, newValue} => {
			let deferred = promise.defer();

			let targetIndex = key;
			(function _changeValue(client, index) {
				if (index == targetIndex) {
					client.changeKey("value", newValue).then(deferred);
				} else {
					client.properties().then(properties => {
						// Note that we can just check properties.next directly without
						// having to fetch the object for it. This is because we
						// magically wrap any grip clients as simplified grip clients
						// (described above).
						if (properties.next) {
							_changeValue(properties.next, index);
						} else {
							dererred.reject();
						}
					});
				}
			}) (this._client, 0)

			return deferred.promise;
		},
		changeKey: {key, newKey} => promise.reject(),
		deleteKey: {key} => promise.reject()
	};

### Starting Points

* Will rely heavily on `browser/devtools/shared/widgets/VariablesView.jsm` and `browser/devtools/shared/widgets/VariablesViewController.jsm` to display objects in in inspector after user has applied filters to them.

### Potential Issues

* Must give the addon-developer the appearance of control over the default Object Inspector code without actually making significant modifications to the VariablesView code.

## Possible Future Goals

* `ProxyRule` instances dictate display in Console in addition to display in Object Inspector:
	* Add a `print` option to `ProxyRule` which produces an object that will display in the Console if that `ProxyRule`'s `filter` is matched.
	* One issue: if we rename certain fields in the object before displaying it, we have to know what to do when the user clicks on those same fields. This seems like it would require another set of the `changeKey`, etc. callbacks used for the Inspector. This could easily become too big.
* User-Defined Object Inspecter Views:
	* If we remove the restriction that addon developers must use the default Object Inspector's view and allow them to define their own custom views, this SDK feature becomes much more powerful.
	* In addition UI freedom, developers gain the freedom to install their own listeners in their custom Object Inspectors (instead of being limited to `changeKey`, `changeValue`, and `deleteKey`).
	* Views would no longer need to follow the VariablesView's tree structure.
	* Addon-developers will supply an HTML document to describe their views.
	* Multiple views can sit alongside eachother in tabs.
	* The API might look like this:

		* Top-level methods:

				/*
				 * For consistency, allow the user to get a reference to the
				 * VariablesView, wrapped as an `View`.
				 */
				defaultView()

		* View

				/*
				 * A `View` is a custom UI widget for displaying objects.
				 *
				 * `title`  is the name to given to the tab that this `View`
				 * will occupy if we have multiple `View` instances active at
				 * one time.
				 *
				 * `contentURL` is the path to the HTML page used to render
				 * this `View`.
				 */
				View({title, contentURL})

				/*
				 * These methods allow the `View` to show or force it to
				 * hide.
				 */
				enable()
				disable()

		* ViewRule:

				/*
				 * A `ViewRule` is significantly simpler than a `ProxyRule`.
				 * A `ViewRule` only contains information about when it should
				 * be applied (`filter`) and what to do when an object matches
				 * a filter (`onSelect`).
				 */
				InspectorRule({filter, onSelect})

## Mockup

Inspecting a `LinkedList` with the default VariablesView:

<img src="http://www.contrib.andrew.cmu.edu/~cbrem/files/images/without_rule.png" alt="Object Inspector" style="width: 50%">

Inspecting the same object with the addon from the example:

<img src="http://www.contrib.andrew.cmu.edu/~cbrem/files/images/with_rule.png" alt="Linked List Inspector" style="width: 50%">

## Discussion

[Etherpad](https://etherpad.mozilla.org/6P2gZHE7ug)

[Bugzilla](https://bugzilla.mozilla.org/show_bug.cgi?id=980555)
