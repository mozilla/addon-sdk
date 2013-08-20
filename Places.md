# Places API JEP (WIP)

## Overview

An API for Firefox [Places](https://developer.mozilla.org/en-US/docs/Places) (History and Bookmarks).

[Current Hacking](https://github.com/jsantell/addon-sdk/tree/places-api)

## Goals

* **Phase 1**
	* Provide easy to use API for CRUD, querying History and Bookmarks
* **Phase 2**
	* Hook Bookmark instances to platform observers ([nsINavBookmarkObserver](https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsINavBookmarkObserver))

## Proposed API


### Bookmark

**Bookmark** contains static methods to create, update and manipulate bookmark items like bookmarks, folders and separators. `Bookmark`, `Group` and `Separator` classes all are considered `BookmarkItem` types.

#### Functions

##### Bookmark(properties)

* @param {Object} properties
* @return {Bookmark}

Takes an object of properties, and returns a new `Bookmark` object.

* `String title`: *required* The name of the bookmark
* `String|URL url`: *required* the url (either as a `String` or `URL` instance)
* `Group group`: The `Group` instance that the bookmark should live under. *(Default: the menu folder)*
* `Number index`: The position of the bookmark within its parent. Defaults to the last position. *(Default: -1)* **MAY BE REMOVED**
* `Set tags`: A `Set` of tags.

```
let { Bookmark } = require('bookmark');

Bookmark({
	title: 'Mozilla',
	url: 'http://www.mozilla.org
});
```

##### Group(properties)

* @param {Object} properties
* @return {Group}

Takes an object of properties, and returns a new `Group` object.

* `String title`: *required* The name of the group
* `Group group`: The `Group` instance that the group should live under. *(Default: the menu folder)*
* `Number index`: The position of the bookmark within its parent. Defaults to the last position. *(Default: -1)* **MAY BE REMOVED**

##### Separator(properties)

* @param {Object} properties
* @return {Separator}

Takes an object of properties, and returns a new `Separator` object.

* `Group group`: The `Group` instance that the separator should live under. *(Default: the menu folder)*
* `Number index`: The position of the separator within its parent. Defaults to the last position. *(Default: -1)* **MAY BE REMOVED**


##### save(items, [options])
* @param {BookmarkItems|Array} items
* @param {Object} options
* @return {Emitter}

Pushes properties of `items` to their platform counterparts -- returns a promise that resolves to new instances of these items upon saving.

Options object has one property, `resolve`, which is a function accepting `mine` and `theirs` arguments, which are the item attempting to save and the item currently saved on the platform. `resolve` is called if attempting to save a `BookmarkItem` that has been updated since the object was fetched from the platform to perform a manual diff.

```

let { Bookmark, save } = require('bookmarks');

var bookmarks = [
	{ title: "Moz", url: "http://mozilla.org" },
	{ title: "Twitter", url: "http://twitter.com" }
].map(Bookmark);

save(bookmarks).on('data', function (bookmark) {
  // These instances are new, fresh instances
  // and !== the initial bookmarks passed into input
});

```

Resolving

```
let { search, save } = require('bookmarks');

search({ url: 'http://mozilla.org' }).on('data', updateBookmark);

function updateBookmark (bm) {
  // So let's update this bookmark, and say the user
  // or another add-on has already changed it, so
  // this instance is out of date already.
  
  bm.title = "My Moz";
  
  save(bm, {
    resolve: function (mine, theirs) {
       // Here we can either just choose to 
       // overwrite the title via
       // `theirs.title = mine.title; return theirs;`
       // Which will keep the users' changes other
       // than the title
       
       // Or we can just completely ignore everything the
       // user did and pass all of `bm`s current props:
       // `return mine;`
    }
  })
   
}

```

Recursive Saving

```
let { Bookmark, Group, save } = require('bookmarks');

var g = Group({ title: "Mine" });
var b1 = Bookmark({ url: "http://foo", title: "foo", group: g });
var b2 = Bookmark({ url: "http://bar", title: "bar", group: g});

// Since both `b1` and `b2` have `g` as their parent,
// and `g` has not yet been saved, this will first 
// save `g`, and then save `b1` and `b2`
save([b1, b2])

```

Duck Typing (requires `type` property)

```
save({ url: 'http://foo', title: 'foo', type: 'bookmark' })

```

##### search(queries, options)

* @param {Array|Object} queries
* @param {Object} options
* @return {Emitter}

Queries can be performed on bookmark items by passing in one or more query options. Each query option can take several properties, which are AND'd together to make one complete query. For additional queries within the query, passing more query options in will OR the total results.


* `String url`: A string indicating what URLs are acceptable results. Possible syntax:
	* `mozilla.com` matches any URL with 'mozilla.com' as a host name
	* `*.mozilla.com` matches any URL with 'mozilla.com' as a host, or any subdomain of mozilla.com
	* `http://mozilla.com/` matches only the URL 'http://mozilla.com/'
	* `http://mozilla.com/*` matches any URL that begins with 'http://mozilla.com/*'
* `String query`: Search terms to search url, title, tags
* `Array tags`: Bookmarks with corresponding tags. These are AND'd together.
* `Group group`: Group instance that should be owners of the returned children bookmarks. If no `group` specified, all bookmarks are under the search space.


**NOTE: Searching bookmarks currently only returns bookmarks. To return `folders` and `separators` as well, a [simple query](https://developer.mozilla.org/en-US/docs/Retrieving_part_of_the_bookmarks_tree) must be performed -- that is, a search with only one query object with the only property passed being the `group` property.**

**Need to investigate if this can be changed on the platform, or other workarounds -- currently a workaround is implemented in our Places API to allow non-root folders to be used as `setFolders` in the `nsINavHistoryService`, to result in the same interface for our bookmarks `search`**

More properties may be added via the HistoryQuerying service, such as searching titles.

```
let { search } = require('bookmarks');

// Assume we have group `g1`

// This query gives us all bookmarks with tag 'mozilla'
// that are children of `g1`.
search({
  tags: 'mozilla',
  group: g1
})

// If we wanted to get the children of g1 
// that have tag 'mozilla' OR children of g1 that
// has tag 'firefox', we can make two query options that
// are OR'd together
search({
  tags: 'mozilla',
  group: g1
}, {
  tags: 'firefox',
  group: g1
})

// Similar to the last query, we can all bookmarks that
// are children of `g1` that have BOTH the 'mozilla' and
// 'firefox' tag, as all the properties within a query
// are AND'd together
search({
  tags: ['mozilla', 'firefox'],
  group: g1
})


```

##### Examples

Here are some platform methods converted to using this API


###### Getting Children

```
search({ query: 'my-folder' }).on('data', (g) => {
  search({ group: g }).on('end', function (children) {
    // children
  })
});

```

###### Removing Children


```
search({ query: 'my-folder' }).on('data', (g) => {
  search({ group: g }).on('data', compose(save, remove));
});

let remove = (item) => item.remove = true && item

```



###### Get Bookmarks by URL

```
search({ url: 'http://mozilla.org' })
```


###### Get Bookmarks by Tag

```
search({ tags: 'firefox' })
```

###### Is URL bookmarked

```
search({ url: 'http://mozilla.org' }).on('data', (x) => {
  console.log(!!x.length);
});
```

#### Properties

These constants are `Group` instances of default groups/folders on the platform.

* `MENU`
* `PLACES`
* `TAGS`
* `TOOLBAR`
* `UNSORTED`


#### Bookmark Class

##### Properties

* `id` *readonly*
* `index`
* `title`
* `url`
* `group`
* `tags`

#### Group Class

##### Properties

* `id` *readonly*
* `index`
* `title`
* `group`
* `tags`

#### Separator Class

##### Properties

* `id` *readonly*
* `index`
* `group`

### History

#### Functions

##### search(queries, options)

* @param {Array|Object} queries
* @param {Object} options
* @return {Emitter}

Takes an object, or array of objects, as query parameter objects, and optionally an `options` object. Like Bookmark's `search`, query parameters are AND'd together, and multiple queries are OR'd together.

**TODO DESCRIBE PROMISE EMITTER**
Returns a promise for an array of history items that match the query's `options`.

###### Query Parameters

*  `String url`: A string indicating what URLs are acceptable results. Possible syntax:
	* `mozilla.com` matches any URL with 'mozilla.com' as a host name
	* `*.mozilla.com` matches any URL with 'mozilla.com' as a host, or any subdomain of mozilla.com
	* `http://mozilla.com/` matches only the URL 'http://mozilla.com/'
	* `http://mozilla.com/*` matches any URL that begins with 'http://mozilla.com/*'
*  `String query`: Search terms to match history results with `query` in its URL or title.
* `Date|Number from`: Time relative from the [epoch](http://en.wikipedia.org/wiki/Unix_time) that history results should be limited to occuring after. Can accept a `Date` object, or milliseconds from the epoch. Default is from the epoch (all time).
* `Date|Number to`: Time relative from the [epoch](http://en.wikipedia.org/wiki/Unix_time) that history results should be limited to occuring before. Can accept a `Date` object, or milliseconds from the epoch. Default is the current time.

###### Options

* `String sort`: A string to specify the type of sort to use. Possible options: `'title'`, `'date'`, `'url'`, `'visitCount'`, `'keyword'`, `'dateAdded'`, `'lastModified'`. Default is unsorted.
* `Boolean descending`: Whether or not the sorted results should be in descending order. Default is `false`, which returns the results in an ascending order. Has no effect if `sort` is undefined.
* `Number count`: Upper limit of how many items are returned. Default is no limit.

```javascript
let { search } = require('sdk/places/history');

/*
 * This query is all page visits from the year 2010
 * with "google" in their URL or title, and also all
 * page visits from the year 2011 with "mozilla" in their URL
 * or title. The result is sorted by visit count, and the first
 * 20 are returned
 */
let results = search({
  from: new Date('1/1/2010'),
  to: new Date('12/31/2010'),
  query: 'google'
}, {
  from: new Date('1/1/2011'),
  to: new Date('12/31/2011'),
  query: 'mozilla'
}, {
  sort: 'visitCount',
  count: 20
});

results.then(data => {

});

```


## Notes 6/3/2013

* Use Emitters rather than Promises, as both save and querying returns a collection of information, rather than one computation. With promises, if one save failed, it'd be ambiguous how to recover.
* Don't expose an "update/refresh" method
* Rename `folders` to `groups` -- more conceptual, and futureproofs if the UI of bookmarks is displayed differently
* Make `id` property immutable and non-enumerable, ID represents the identity of a bookmark so changing this would break everything
* Robust query interface for bookmarks via `.get({}, {}, …)` have properties like `tags`, `urls`, and other bookmark fields. Will use several services to get the aggregate results. ANDs properties in a single query object, and ORs the results of several query objects (need intersection/union operators on bookmarks).
* Always return a new data object, do not respect identity -- for example querying a bookmark will give you a *snapshot* of its current state, and should be thought of as representation of state rather than the item itself

```
var bm = Bookmark({…});
save(bm).then(function (bookmark) {
  // bm !== bookmark
})
```
* Add a resolution function to save, in case of out-of-date bookmark, as to not make unwanted or accidental changes and let the developer specify how to resolve a conflict, either ignore the save (return theirs) or do a full overwrite (return mine) or just deal with a diff of one property that was saved

```
save({}, { resolve: function (mine, theirs) {
  // If you want to clobber changes, just return mine
  // if out of date -- or can only overwrite something like
  // the tags property. Whatever is returned is saved.
  return mine;
}})
```

* Remove `createBookmark` and similar methods (should just have `Bookmark` which instantiates a data structureish class)
* Remove `index` on Bookmark items ????
* Hide `id`???
* Map `v0` to `v1` since a new bookmark will not have an updated time, so we'll need to map the initial save to the initial data structure to infer if conflict resolution is necessary
* Remove `delete/remove` functions -- done via a variable like `bookmark.remove = true` and passed into `save` method
* remove `removeAllChildren` and `getChildren` -- can be done with a query with a `group` property 
* Recursively save group dependencies when saving bookmarks if needed (save the parent if it doesn't exist while saving a bookmark)
* remove `isBookmarked` -- can be done with a URL query
* Support splats
* Remove `Tags` module -- roll into module with `Set`s
* Prevent duplicate creation (?)


## Resources

* [Places Developer Guide](https://developer.mozilla.org/en-US/docs/Places_Developer_Guide)
* Bookmarks
	* [nsINavBookmarksService [docs]](https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsINavBookmarksService)
	* [Manipulating Bookmarks Using Places](https://developer.mozilla.org/en-US/docs/Manipulating_bookmarks_using_Places)
* History
	* [nsINavHistoryService [docs]](https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsINavHistoryService)
	* [nsIGlobalHistory2 [docs]](https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsIGlobalHistory2)
	* [nsIBrowserHistory [docs]](https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsIBrowserHistory)
	* [mozIAsyncHistory [docs]](https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/mozIAsyncHistory)
	* [Using Places History Service](https://developer.mozilla.org/en-US/docs/Using_the_Places_history_service)
* [Original JEP 22, Places API](https://wiki.mozilla.org/Labs/Jetpack/JEP/22)
* [PlacesQueryAPIRedesign](https://wiki.mozilla.org/Firefox/Projects/PlacesQueryAPIRedesign)
