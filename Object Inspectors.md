# VariablesView APIs

## Overview

The `VariablesView` is a UI widget used by the Webconsole, Debugger, and other devtools components to expand and edit objects. Addon developers may want to make a number of modifications to `VariablesView` instances.

Two SDK APIs could break out some of the `VariablesView`'s most useful features to addon developers:

* `Object Inspectors`: This API would allow developers to Modify the manner in which the VariablesView fetches data for the objects it's displaying.
* `VariablesView Navigator`: This API would allow developers to retrieve and then traverse active `VariablesView` instances. For now, this would allow only 'read-only' inspection of the `VariablesView`.

## Object Inspectors

To get information about objects being displayed in the `VariablesView`, the devtools use asynchronous Object clients to retrieve object properties. The `Object Inspectors` API allows developers to proxy these clients and fake, hide, or otherwise modify which properties objects expose through their clients.

### Use cases

Some potential use cases for this API include:

* Hide private fields (example below)
* Represent objects from compile-to-JS lanuages or JS libraries in more intuitive formats
* Trigger additional effects when users update the object on display in the VariablesView
	* For example, alert users when they try to set one a field of the object under inspection to an illegal value.

### Implementation

Some implementation details or solutions to edge-cases:

* Potential problems arise when addons install multiple `Object Inspectors` on one `VariablesView`. In this case, we can actually replace the `VariablesView` UI widget with a `tabbox` which contains multiple `VariablesView` widgets, one for each active `Object Inspector`.

### API

We represent the default ObjectInspector, which is truthful about all of an object's properties, as such:

	class ObjectInspector {
	  getOwnKeys() : Promise <[String]>
	  getPropertyDescriptor(key) : Promise <[{configurable: Boolean, enumerable: Boolean, writable: Boolean, value: ObjectInspector|PrimitiveValue }]>,
	  getPrototype: Promise <ObjectInspector|null>,
	  isFrozen: Promise <Boolean>,
	  isExtensible: Promise <Boolean>,
	  isSealed: Promise <Boolean>,

	  // modification methods
	  setProperty(key, value): Promise <Boolean> // suceeded or failed to modify
	  removeProperty(key): Promise <Boolean> // suceeded or failed to modify
	}

To create their own `Object Inspector`, developers subclass the `ObjectInspector` class. They can specify one of more 'sources' for which this inspector should replace the default inspector: the Webconsole and Debugger are examples of sources.

Note that an `ObjectInspector` provides an asynchronous, promise-based client for an actual object that exists in content.

### Usage example

The `Object Inspectors` API can be used to construct a simple addon which shows only the 'public' fields in objects (here defined as fields with names that do not start with '_').

	class PublicFieldInspector extends ObjectInspector {
		Sources: [Webconsole, Debugger],
	    getOwnKeys() {
	        return ObjectInspector.prototype.getOwnKeys.call(this).then(function() {
	            return publicFields(keys);
	        });
	    },
	    getPrototype() ObjectInspector.prototype.getPrototype.call(this),
	    getPropertyDescriptor(key) ObjectInspector.prototype.getPrototype.call(this, key),
	};

	Tool({
	    inspectors: {
	        publicFields: PublicFieldInspector
	    }
	})

### Future Considerations

After implementing the basic API, we can explore the following additions:

* In addition to clients for Objects, we should consider adding clients for LongStrings, Arrays, Functions, and other sorts of JS constructs.

## Variables View Navigator

The `Navigator` would allow users to explore the contents of a (wrapped version of a) `VariablesView` instance. This exploration would be read-only for now.

### Use Cases
* SDK tests involving the VariablesView

### API
Devtools models the `VariablesView` as a tree. In the `Navigator` API, we will modify this model only slightly. For example, the devtools view is filled lazily; we will hide this fact from users by filling out Objects as the user explores them.

	getVariablesViews(tab) -> { source : { addonID : VariableView } }
	class VariablesView {
	    getEntries() this.getScopes(),
	    getScopes(): { scopeName -> ScopeView }
	}
	class ScopeView {
	    getEntries() -> this.getVariables(),
	    getVariables() -> { variableName ->  ObjectView | PrimitiveView }
	}
	class PrimitiveView {
	    value: primitive
	}
	class ObjectView {
	    // Gives PrimitiveView|ObjectView objects that are children if they exist,
	    // or gets properties thru client and creates Views before returning them.
	    //
	    // i.e. don't admit to the user that this is lazy
	    getEntries() -> this.getProperties(),
	    getProperties() : { propertyName -> ObjectView | PrimitiveView }
	}

### Future Considerations
* Remove the need for this exploration to be read-only. This would likely require retooling/integration of the `Object Inspectors` API.

## Discussion

[Bugzilla](https://bugzilla.mozilla.org/show_bug.cgi?id=980555)
