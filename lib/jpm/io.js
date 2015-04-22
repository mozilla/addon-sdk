/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { OS: {File, Path}} = require("resource://gre/modules/osfile.jsm");
const { Task } = require("resource://gre/modules/Task.jsm");

const uriToPath = uri => Path.fromFileURI(uri);
exports.uriToPath = uriToPath;

const exists = path => File.exists(path);
exports.exists = exists;

const isDirectory = path => File.stat(path).then(({isDir}) => isDir);
exports.isDirectory = isDirectory;

const isFile = path => isDirectory(path).then(x => !x);
exports.isFile = isFile;

const list = directory => Task.spawn(function*(){
  let iterator = new File.DirectoryIterator(directory);
  let entries = []
  try {
    while (true) {
     let {path} = yield iterator.next();
     entries.push(path);
    }
  } catch(error) {
    if (error.toString() !== "[object StopIteration]") {
      throw error
    }
  } finally {
    iterator.close();
  }
  return entries;
});
exports.list = list;

const listTree = (directory, options={includeDirectories:true}) =>
  Task.spawn(function*() {
    const {includeDirectories} = options;
    const entries = yield list(directory);
    const result = [];
    for (let entry of entries) {
      if (yield isDirectory(entry)) {
        if (includeDirectories) {
          result.push(entry);
        }

        let nested = yield listTree(entry, options);
        result.push(...nested);
      }
      else {
        result.push(entry);
      }
    }
    return result
  });
exports.listTree = listTree

const read = path => File.read(path);
exports.read = read;

const remove = path => File.remove(path);
exports.remove = remove;
