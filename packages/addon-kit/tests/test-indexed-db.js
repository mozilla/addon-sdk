/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

const { indexedDB, IDBKeyRange, DOMException, IDBCursor, IDBTransaction,
        IDBOpenDBRequest, IDBVersionChangeEvent, IDBDatabase, IDBFactory,
        IDBIndex, IDBObjectStore, IDBRequest
      } = require('indexed-db');


exports['test db variables'] = function(assert) {
  [ indexedDB, IDBKeyRange, DOMException, IDBCursor, IDBTransaction,
    IDBOpenDBRequest, IDBOpenDBRequest, IDBVersionChangeEvent,
    IDBDatabase, IDBFactory, IDBIndex, IDBObjectStore, IDBRequest
  ].forEach(function(value) {
    assert.notEqual(typeof(value), 'undefined', 'variable is defined');
  });
}

exports['test open'] = function(assert, done) {
  let request = indexedDB.open('MyTestDatabase');
  request.onerror = function(event) {
    assert.fail('Failed to open indexedDB')
    done();
  };
  request.onsuccess = function(event) {
    assert.pass('IndexedDB was open');
    done();
  };
};

exports['test structuring the database'] = function(assert, done) {
  // This is what our customer data looks like.
  let customerData = [
    { ssn: '444-44-4444', name: 'Bill', age: 35, email: 'bill@company.com' },
    { ssn: '555-55-5555', name: 'Donna', age: 32, email: 'donna@home.org' }
  ];
  let dbName = 'the_name';
  let request = indexedDB.open(dbName, 2);
  request.onerror = function(event) {
    assert.fail('Failed to open db');
    done();
  };
  request.onsuccess = function(event) {
    assert.pass('transaction is complete');
    testRead(assert, done);
  }
  request.onupgradeneeded = function(event) {
    assert.pass('data base upgrade')

    var db = event.target.result;

    // Create an objectStore to hold information about our customers. We're
    // going to use 'ssn' as our key path because it's guaranteed to be
    // unique.
    var objectStore = db.createObjectStore('customers', { keyPath: 'ssn' });

    // Create an index to search customers by name. We may have duplicates
    // so we can't use a unique index.
    objectStore.createIndex('name', 'name', { unique: false });

    // Create an index to search customers by email. We want to ensure that
    // no two customers have the same email, so use a unique index.
    objectStore.createIndex('email', 'email', { unique: true });

    // Store values in the newly created objectStore.
    customerData.forEach(function(data) {
      objectStore.add(data);
    });
    assert.pass('data added to object store');
  };
};

function testRead(assert, done) {
  let dbName = 'the_name';
  let request = indexedDB.open(dbName, 2);
  request.onsuccess = function(event) {
    assert.pass('data opened')
    var db = event.target.result;
    let transaction = db.transaction(['customers']);
    var objectStore = transaction.objectStore('customers');
    var request = objectStore.get('444-44-4444');
    request.onerror = function(event) {
      assert.fail('Failed to retrive data')
    };
    request.onsuccess = function(event) {
      // Do something with the request.result!
      assert.equal(request.result.name, 'Bill', 'Name is correct');
      done();
    };
  };
  request.onerror = function() {
    assert.fail('failed to open db');
  };
};


require('test').run(exports);
