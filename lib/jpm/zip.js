/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const {Cc, Ci, Cr} = require("chrome");
const {dirname} = require("sdk/fs/path");

const PR_RDONLY      = 0x01;
const PR_WRONLY      = 0x02;
const PR_RDWR        = 0x04;
const PR_CREATE_FILE = 0x08;
const PR_APPEND      = 0x10;
const PR_TRUNCATE    = 0x20;
const PR_SYNC        = 0x40;
const PR_EXCL        = 0x80;


const converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].
                  createInstance(Ci.nsIScriptableUnicodeConverter);
converter.charset = "UTF-8";
const dataStream = data => converter.convertToInputStream(data);

const makeFile = path => {
  const file = Cc["@mozilla.org/file/local;1"].
                createInstance(Ci.nsILocalFile);
  try {
    file.initWithPath(path);
  } catch(e) {
    throw new Error(`This zip file path is not valid: ${path} \n ${e}`);
  }

  return file;
}

const ensureDirectories = (zip, path) => {
  zip.addEntryDirectory(path, null, true);
}




const ZipWriter = function(content) {
  this.content = content
}
ZipWriter.prototype = {
  constructor: ZipWriter,
  write(path, mode=PR_RDWR | PR_CREATE_FILE | PR_TRUNCATE) {
    return new Promise((resolve, reject) => {
      let zip = Cc["@mozilla.org/zipwriter;1"].
        createInstance(Ci.nsIZipWriter);

      zip.open(makeFile(path), mode);

      for (let path of Object.keys(this.content)) {
        let entry = this.content[path]
        entry[ZipWriter.updateZipEntry](path, zip);
      }

      zip.processQueue({
        onStartRequest: (request, _) => {},
        onStopRequest: (request, _, status) => {
          zip.close();
          if (status === Cr.NS_OK) {
            resolve();
          } else {
            reject();
          }
        }
      }, null);
    })
  }
};
ZipWriter.updateZipEntry = Symbol("ZipWriter/updateZipEntry");
exports.ZipWriter = ZipWriter;


const ZipEntry = function() {}
ZipEntry.prototype = {
  [ZipWriter.updateZipEntry]() {
    throw TypeError("ZipEntry type must implement ZipWriter.updateZipEntry method")
  }
};
ZipWriter.ZipEntry = ZipEntry;
exports.ZipEntry = ZipEntry;


const EntryRemoval = function() {}
EntryRemoval.prototype = Object.assign(new ZipEntry(), {
  constructor: EntryRemoval,
  [ZipWriter.updateZipEntry](path, zip) {
    zip.removeEntry(path, true)
  }
});
ZipWriter.EntryRemoval = EntryRemoval;
exports.EntryRemoval = EntryRemoval;


const StringDataEntry = function(data) {
  this.data = data
}
StringDataEntry.prototype = Object.assign(new ZipEntry(), {
  constructor: StringDataEntry,
  [ZipWriter.updateZipEntry](path, zip) {
    zip.addEntryStream(path, 0,
                       Ci.nsIZipWriter.COMPRESSION_DEFAULT,
                       dataStream(this.data),
                       true);
  }
});
ZipWriter.StringDataEntry = StringDataEntry;
exports.StringDataEntry = StringDataEntry;

const FileEntry = function(path) {
  this.path = path
}
FileEntry.prototype = Object.assign(new ZipEntry(), {
  constructor: FileEntry,
  [ZipWriter.updateZipEntry](path, zip) {
    zip.addEntryFile(path,
                     Ci.nsIZipWriter.COMPRESSION_DEFAULT,
                     makeFile(this.path),
                     true);
  }
});
ZipWriter.FileEntry = FileEntry;
exports.FileEntry = FileEntry;

