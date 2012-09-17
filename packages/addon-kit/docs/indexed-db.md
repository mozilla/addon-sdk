r<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

The `indexed-db` module exposes the
[IndexedDB API](https://developer.mozilla.org/en-US/docs/IndexedDB)
to add-ons.

The IndexedDB API is accessible to scripts running in web pages
as a collection of attributes of the global `window` object.
For example, to create or open a database a page script would use the
[`indexedDB` attribute](https://developer.mozilla.org/en-US/docs/IndexedDB/IDBEnvironment),
or its prefixed equivalent:

    window.indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.msIndexedDB;

    var request = window.indexedDB.open("MyDatabase");
    request.onerror = function(event) {
      console.log("failure");
    };
    request.onsuccess = function(event) {
      console.log("success");
    };

Because your main add-on code can't access the DOM, you can't use these
attributes. Instead, you can use the `indexed-db` module to access the same
API:

    var { indexedDB } = require('indexed-db');

    var request = indexedDB.open('MyDatabase');
    request.onerror = function(event) {
      console.log("failure");
    };
    request.onsuccess = function(event) {
      console.log("success");
    };

The `indexed-db`
Apart from the `indexedDB` object itself, 

<api name="set">
@function
  Replace the contents of the user's clipboard with the provided data.
@param data {string}
  The data to put on the clipboard.
@param [datatype] {string}
  The type of the data (optional).
</api>

<api name="get">
@function
  Get the contents of the user's clipboard.
@param [datatype] {string}
  Retrieve the clipboard contents only if matching this type (optional).
  The function will return null if the contents of the clipboard do not match
  the supplied type.
</api>

<api name="currentFlavors">
@property {array}
  Data on the clipboard is sometimes available in multiple types. For example,
  HTML data might be available as both a string of HTML (the `html` type)
  and a string of plain text (the `text` type). This function returns an array
  of all types in which the data currently on the clipboard is available.
</api>
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

module.metadata = {
  "stability": "experimental"
};

const { Cc, Ci } = require('chrome');
const { id } = require('self');

// Injects `indexedDB` to `this` scope.
Cc["@mozilla.org/dom/indexeddb/manager;1"].
getService(Ci.nsIIndexedDatabaseManager).
initWindowless(this);

// Wrap `indexedDB` methods in order to prefix names
// with add-on IDs. This is temporary workaround for
// Bug 786688. Note: once bug is fixed and prefixing is
// removed existing DBs will appear non-existing.
function prefixWrapper(method) {
  return function(name) {
    let args = [ id + ':' + name ].concat(Array.slice(arguments, 1));
    return method.apply(indexedDB, args);
  }
}
exports.indexedDB = Object.create(indexedDB, {
  open: { value: prefixWrapper(indexedDB.open) },
  deleteDatabase: { value: prefixWrapper(indexedDB.deleteDatabase) }
});
exports.IDBKeyRange = IDBKeyRange;
exports.DOMException = Ci.nsIDOMDOMException;
exports.IDBCursor = Ci.nsIIDBCursor;
exports.IDBTransaction = Ci.nsIIDBTransaction;
exports.IDBOpenDBRequest = Ci.nsIIDBOpenDBRequest;
exports.IDBVersionChangeEvent = Ci.nsIIDBVersionChangeEvent;
exports.IDBDatabase = Ci.nsIIDBDatabase;
exports.IDBFactory = Ci.nsIIDBFactory;
exports.IDBIndex = Ci.nsIIDBIndex;
exports.IDBObjectStore = Ci.nsIIDBObjectStore;
exports.IDBRequest = Ci.nsIIDBRequest;
