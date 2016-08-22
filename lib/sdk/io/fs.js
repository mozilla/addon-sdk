/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
"use strict";

module.metadata = {
  "stability": "experimental"
};

const { Cc, Ci, CC } = require("chrome");

const { setTimeout } = require("../timers");
const { Stream, InputStream, OutputStream } = require("./stream");
const { Buffer } = require("./buffer");
const { ns } = require("../core/namespace");
const { Class } = require("../core/heritage");

const RawFile = CC("@mozilla.org/file/local;1", "nsILocalFile",
                          "initWithPath");
const FileOutputStream = CC("@mozilla.org/network/file-output-stream;1",
                            "nsIFileOutputStream", "init");
const FileInputStream = CC("@mozilla.org/network/file-input-stream;1",
                           "nsIFileInputStream", "init");
const BinaryInputStream = CC("@mozilla.org/binaryinputstream;1",
                             "nsIBinaryInputStream", "setInputStream");
const BinaryOutputStream = CC("@mozilla.org/binaryoutputstream;1",
                              "nsIBinaryOutputStream", "setOutputStream");
const StreamPump = CC("@mozilla.org/network/input-stream-pump;1",
                      "nsIInputStreamPump", "init");

const { createOutputTransport, createInputTransport } =
  Cc["@mozilla.org/network/stream-transport-service;1"].
  getService(Ci.nsIStreamTransportService);


const { REOPEN_ON_REWIND, DEFER_OPEN } = Ci.nsIFileInputStream;
const { DIRECTORY_TYPE, NORMAL_FILE_TYPE } = Ci.nsIFile;
const { NS_SEEK_SET, NS_SEEK_CUR, NS_SEEK_END } = Ci.nsISeekableStream;

const FILE_PERMISSION = parseInt("0666", 8);
const PR_UINT32_MAX = 0xfffffff;
// Values taken from:
// http://mxr.mozilla.org/mozilla-central/source/nsprpub/pr/include/prio.h#615
const PR_RDONLY =       0x01;
const PR_WRONLY =       0x02;
const PR_RDWR =         0x04;
const PR_CREATE_FILE =  0x08;
const PR_APPEND =       0x10;
const PR_TRUNCATE =     0x20;
const PR_SYNC =         0x40;
const PR_EXCL =         0x80;

const FLAGS = {
  "r":                  PR_RDONLY,
  "r+":                 PR_RDWR,
  "w":                  PR_CREATE_FILE | PR_TRUNCATE | PR_WRONLY,
  "w+":                 PR_CREATE_FILE | PR_TRUNCATE | PR_RDWR,
  "a":                  PR_APPEND | PR_CREATE_FILE | PR_WRONLY,
  "a+":                 PR_APPEND | PR_CREATE_FILE | PR_RDWR
};

const _ = ns();

function isWritable(mode) { return !!(mode & PR_WRONLY || mode & PR_RDWR); }
function isReadable(mode) { return !!(mode & PR_RDONLY || mode & PR_RDWR); }

function isString(value) { return typeof value === "string"; }
function isFunction(value) { return typeof value === "function"; }

function toArray(enumerator) {
  let value = [];
  while(enumerator.hasMoreElements())
    value.push(enumerator.getNext())
  return value
}

function defer(wrapped) {
  return function deferred() {
    setTimeout(function(self, args) {
      wrapped.apply(self, args);
    }, 0, this, Array.slice(arguments));
  }
}
function getFileName(file) {
  return file.QueryInterface(Ci.nsIFile).leafName;
}

function remove(path, recursive) {
  return new RawFile(path).remove(recursive || false);
}
function Mode(mode, fallback) {
  return isString(mode) ? parseInt(mode) : mode || fallback;
}
function Flags(flag) {
  return !isString(flag) ? flag :
         FLAGS[flag] || Error("Unknown file open flag: " + flag);
}


const ReadStream = Class({
  extends: InputStream,
  initialize: function initialize(path, options) {
    this.position = -1;
    this.length = -1;
    this.flags = "r";
    this.mode = FILE_PERMISSION;
    this.bufferSize = 64 * 1024;

    options = options || {};

    if ("flags" in options && options.flags)
      this.flags = options.flags;
    if ("bufferSize" in options && options.bufferSize)
      this.bufferSize = options.bufferSize;
    if ("length" in options && options.length)
      this.length = options.length;
    if ("position" in options && options.position !== undefined)
      this.position = options.position;

    let { flags, mode, position, length } = this;
    let { input } = _(isString(path) ? openSync(path, flags, mode) : path);
    // Setting a stream position, unless it"s `-1` which means current position.
    if (position >= 0)
      input.QueryInterface(Ci.nsISeekableStream).seek(NS_SEEK_SET, position);
    // We use `nsIStreamTransportService` service to transform blocking
    // file input stream into a fully asynchronous stream that can be written
    // without blocking the main thread.
    let transport = createInputTransport(input, position, length, false);
    // Open an input stream on a transport. We don"t pass flags to guarantee
    // non-blocking stream semantics. Also we use defaults for segment size &
    // count.
    let asyncInputStream = transport.openInputStream(null, 0, 0);
    let binaryInputStream = BinaryInputStream(asyncInputStream);
    let pump = StreamPump(asyncInputStream, position, length, 0, 0, false);

    InputStream.prototype.initialize.call(this, {
      input: binaryInputStream, pump: pump
    });
    this.read();
  }
});
exports.ReadStream = ReadStream;
exports.createReadStream = function createReadStream(path, options) {
  return new ReadStream(path, options);
};

const WriteStream = Class({
  extends: OutputStream,
  initialize: function initialize(path, options) {
    this.drainable = true;
    this.flags = "w";
    this.position = -1;
    this.mode = FILE_PERMISSION;

    options = options || {};

    if ("flags" in options && options.flags)
      this.flags = options.flags;
    if ("mode" in options && options.mode)
      this.mode = options.flags;
    if ("position" in options && options.position !== undefined)
      this.position = options.position;

    let { position, flags, mode } = this;
    // If pass was passed we create a file descriptor out of it. Otherwise
    // we just use given file descriptor.
    let { output } = _(isString(path) ? openSync(path, flags, mode) : path);
    // Setting a stream position, unless it"s `-1` which means current position.
    if (position >= 0)
      output.QueryInterface(Ci.nsISeekableStream).seek(NS_SEEK_SET, position);
    // We use `nsIStreamTransportService` service to transform blocking
    // file output stream into a fully asynchronous stream that can be written
    // without blocking the main thread.
    let transport = createOutputTransport(output, position, -1, false);
    // Open an output stream on a transport. We don"t pass flags to guarantee
    // non-blocking stream semantics. Also we use defaults for segment size &
    // count.
    let asyncOutputStream = transport.openOutputStream(null, 0, 0);
    // Finally we create a non-blocking binary output stream. This will allows
    // us to write buffers as byte arrays without any further transcoding.
    let binaryOutputStream = BinaryOutputStream(asyncOutputStream);
    // Storing output stream so that it can be accessed later.
    OutputStream.prototype.initialize.call(this, {
      output: binaryOutputStream,
      asyncOutputStream: asyncOutputStream
    });
  }
});
exports.WriteStream = WriteStream;
exports.createWriteStream = function createWriteStream(path, options) {
  return new WriteStream(path, options);
};

const Stats = Class({
  initialize: function initialize(path) {
    _(this).rawFile = new RawFile(path);
    if (!this.exists)
      throw Error("ENOENT, no such file or directory '" + path + "'");
  },
  isDirectory: function isDirectory() {
    return _(this).rawFile.isDirectory();
  },
  isFile: function isFile() {
    return _(this).rawFile.isFile();
  },
  isSymbolicLink: function isSymbolicLink() {
    return _(this).rawFile.isSymlink();
  },


  get mode() {
    return _(this).rawFile.permissions;
  },
  get size() {
    return _(this).rawFile.fileSize;
  },
  get mtime() {
    return _(this).rawFile.lastModifiedTime;
  },

  isBlockDevice: function isBlockDevice() {
    return _(this).rawFile.isSpecial();
  },
  isCharacterDevice: function isCharacterDevice() {
    return _(this).rawFile.isSpecial();
  },
  isFIFO: function isFIFO() {
    return _(this).rawFile.isSpecial();
  },
  isSocket: function isSocket() {
    return _(this).rawFile.isSpecial();
  },

  // non standard
  get exists() {
    return _(this).rawFile.exists();
  },
  get hidden() {
    return _(this).rawFile.isHidden();
  },
  get writable() {
    return _(this).rawFile.isWritable();
  },
  get readable() {
    return _(this).rawFile.isReadable();
  }
});
exports.Stats = Stats;

const LStats = Class({
  extends: Stats,
  get size() {
    return this.isSymbolicLink() ? _(this).rawFile.fileSizeOfLink :
                                   _(this).rawFile.fileSize;
  },
  get mtime() {
    return this.isSymbolicLink() ? _(this).rawFile.lastModifiedTimeOfLink :
                                   _(this).rawFile.lastModifiedTime;
  },

  // non standard
  get permissions() {
    return this.isSymbolicLink() ? _(this).rawFile.permissionsOfLink :
                                   _(this).rawFile.permissions;
  }
});
const FStat = Class({
  extends: Stats,
  initialize: function initialize(fd) {
    _(this).rawFile = _(fd).rawFile;
  }
});

function Async(wrapped) {
  return function (path, callback) {
    let args = Array.slice(arguments);
    callback = args.pop();
    setTimeout(function() {
      try {
        var result = wrapped.apply(this, args);
        if (result === undefined) callback(null);
        else callback(null, result);
      } catch (error) {
        callback(error);
      }
    }, 0);
  }
}


/**
 * Synchronous rename(2)
 */
exports.renameSync = function renameSync(source, target) {
  let source = new RawFile(source);
  let target = new RawFile(target);
  return source.moveTo(target.parent, target.leafName);
};
/**
 * Asynchronous rename(2). No arguments other than a possible exception are
 * given to the completion callback.
 */
exports.rename = Async(exports.renameSync);

/**
 * Test whether or not the given path exists by checking with the file system.
 */
exports.existsSync = function existsSync(path) {
  return new RawFile(path).exists();
}
exports.exists = Async(exports.existsSync);

/**
 * Synchronous ftruncate(2).
 */
exports.truncateSync = function truncateSync(fd, length) {
  return RawFile(path).create(NORMAL_FILE_TYPE, PR_TRUNCATE | PR_CREATE_FILE);
};
/**
 * Asynchronous ftruncate(2). No arguments other than a possible exception are
 * given to the completion callback.
 */
exports.truncate = Async(exports.truncateSync);

/**
 * Synchronous chmod(2).
 */
exports.chmodSync = function chmodSync (path, mode) {
  throw Error("Not implemented yet!!");
};
/**
 * Asynchronous chmod(2). No arguments other than a possible exception are
 * given to the completion callback.
 */
exports.chmod = Async(exports.chmod);

/**
 * Synchronous stat(2). Returns an instance of `fs.Stats`
 */
exports.statSync = function statSync(path) {
  return new Stats(path);
};
/**
 * Asynchronous stat(2). The callback gets two arguments (err, stats) where
 * stats is a `fs.Stats` object. It looks like this:
 */
exports.stat = Async(exports.statSync);

/**
 * Synchronous lstat(2). Returns an instance of `fs.Stats`.
 */
exports.lstatSync = function lstatSync(path) {
  return new LStats(path);
};
/**
 * Asynchronous lstat(2). The callback gets two arguments (err, stats) where
 * stats is a fs.Stats object. lstat() is identical to stat(), except that if
 * path is a symbolic link, then the link itself is stat-ed, not the file that
 * it refers to.
 */
exports.lstat = Async(exports.lstartSync);

/**
 * Synchronous fstat(2). Returns an instance of `fs.Stats`.
 */
exports.fstatSync = function fstatSync(fd) {
  return new FStat(fd);
};
/**
 * Asynchronous fstat(2). The callback gets two arguments (err, stats) where
 * stats is a fs.Stats object.
 */
exports.fstat = Async(exports.fstatSync);

/**
 * Synchronous link(2).
 */
exports.linkSync = function linkSync(source, target) {
  throw Error("Not implemented yet!!");
};
/**
 * Asynchronous link(2). No arguments other than a possible exception are given
 * to the completion callback.
 */
exports.link = Async(exports.linkSync);

/**
 * Synchronous symlink(2).
 */
exports.symlinkSync = function symlinkSync(source, target) {
  throw Error("Not implemented yet!!");
};
/**
 * Asynchronous symlink(2). No arguments other than a possible exception are
 * given to the completion callback.
 */
exports.symlink = Async(exports.symlinkSync);

/**
 * Synchronous readlink(2). Returns the resolved path.
 */
exports.readlinkSync = function readlinkSync(path) {
  return new RawFile(path).target;
};
/**
 * Asynchronous readlink(2). The callback gets two arguments
 * `(error, resolvedPath)`.
 */
exports.readlink = Async(exports.readlinkSync);

/**
 * Synchronous realpath(2). Returns the resolved path.
 */
exports.realpathSync = function realpathSync(path) {
  return new RawFile(path).path;
};
/**
 * Asynchronous realpath(2). The callback gets two arguments
 * `(err, resolvedPath)`.
 */
exports.realpath = Async(exports.realpathSync);

/**
 * Synchronous unlink(2).
 */
exports.unlinkSync = remove;
/**
 * Asynchronous unlink(2). No arguments other than a possible exception are
 * given to the completion callback.
 */
exports.unlink = Async(exports.unlinkSync);

/**
 * Synchronous rmdir(2).
 */
exports.rmdirSync = remove;
/**
 * Asynchronous rmdir(2). No arguments other than a possible exception are
 * given to the completion callback.
 */
exports.rmdir = Async(exports.rmdirSync);

/**
 * Synchronous mkdir(2).
 */
exports.mkdirSync = function mkdirSync(path, mode) {
  return RawFile(path).create(DIRECTORY_TYPE, Mode(mode));
};
/**
 * Asynchronous mkdir(2). No arguments other than a possible exception are
 * given to the completion callback.
 */
exports.mkdir = Async(exports.mkdirSync);

/**
 * Synchronous readdir(3). Returns an array of filenames excluding `"."` and
 * `".."`.
 */
exports.readdirSync = function readdirSync(path) {
  return toArray(new RawFile(path).directoryEntries).map(getFileName);
}
/**
 * Asynchronous readdir(3). Reads the contents of a directory. The callback
 * gets two arguments `(error, files)` where `files` is an array of the names
 * of the files in the directory excluding `"."` and `".."`.
 */
exports.readdir = Async(exports.readdirSync);

/**
 * Synchronous close(2).
 */
exports.closeSync = function closeSync(fd) {
  fd = _(fd);

  // Closing input stream and removing reference.
  if (fd.input)
    fd.input.close();
  // Closing output stream and removing reference.
  if (fd.output)
    fd.output.close();
};
/**
 * Asynchronous close(2). No arguments other than a possible exception are
 * given to the completion callback.
 */
exports.close = Async(exports.closeSync);

/**
 * Synchronous open(2).
 */
function openSync(path, flags, mode) {
  let [ fd, flags, mode, rawFile ] =
      [ { path: path }, Flags(flags), Mode(mode), RawFile(path) ];

  _(fd).rawFile = rawFile;
  // If we want to open file in read mode we initialize input stream.
  _(fd).input = isReadable(flags) ?
                FileInputStream(rawFile, flags, mode, DEFER_OPEN) : null;

  // If we want to open file in write mode we initialize output stream for it.
  _(fd).output = isWritable(flags) ?
                 FileOutputStream(rawFile, flags, mode, DEFER_OPEN) : null;

  return fd;
}
exports.openSync = openSync;
/**
 * Asynchronous file open. See open(2). Flags can be
 * `"r", "r+", "w", "w+", "a"`, or `"a+"`. mode defaults to `0666`.
 * The callback gets two arguments `(error, fd).
 */
exports.open = Async(exports.openSync);

/**
 * Synchronous version of buffer-based fs.write(). Returns the number of bytes
 * written.
 */
exports.writeSync = function writeSync(fd, buffer, offset, length, position) {
  throw Error("Not implemented");
};
/**
 * Write buffer to the file specified by fd.
 *
 * `offset` and `length` determine the part of the buffer to be written.
 *
 * `position` refers to the offset from the beginning of the file where this
 * data should be written. If `position` is `null`, the data will be written
 * at the current position. See pwrite(2).
 *
 * The callback will be given three arguments `(error, written, buffer)` where
 * written specifies how many bytes were written into buffer.
 *
 * Note that it is unsafe to use `fs.write` multiple times on the same file
 * without waiting for the callback.
 */
exports.write = function write(fd, buffer, offset, length, position, callback) {
  if (!Buffer.isBuffer(buffer)) {
    // (fd, data, position, encoding, callback)
    let encoding = null;
    [ position, encoding, callback ] = Array.slice(arguments, 1);
    buffer = new Buffer(String(buffer), encoding);
    offset = 0;
  } else if (length + offset > buffer.length) {
    throw Error("Length is extends beyond buffer");
  } else if (length + offset !== buffer.length) {
    buffer = buffer.slice(offset, offset + length);
  }

  let writeStream = new WriteStream(fd, { position: position, length: length });
  writeStream.on("error", callback);
  writeStream.write(buffer, function onEnd() {
    writeStream.destroy();
    if (callback)
      callback(null, buffer.length, buffer);
  });
};

/**
 * Synchronous version of string-based fs.read. Returns the number of
 * bytes read.
 */
exports.readSync = function readSync(fd, buffer, offset, length, position) {
  throw Error("Not implemented");
};
/**
 * Read data from the file specified by `fd`.
 *
 * `buffer` is the buffer that the data will be written to.
 * `offset` is offset within the buffer where writing will start.
 *
 * `length` is an integer specifying the number of bytes to read.
 *
 * `position` is an integer specifying where to begin reading from in the file.
 * If `position` is `null`, data will be read from the current file position.
 *
 * The callback is given the three arguments, `(error, bytesRead, buffer)`.
 */
exports.read = function read(fd, buffer, offset, length, position, callback) {
  if (!Buffer.isBuffer(buffer)) { // (fd, length, position, encoding, callback)
    [ length, position, encoding, callback ] = Array.slice(arguments, 1);
    buffer = new Buffer(length, encoding);
  }
  let bytesRead = 0;
  let readStream = new ReadStream(fd, { position: position, length: length });
  readStream.on("data", function onData(chunck) {
      chunck.copy(buffer, offset + bytesRead);
      bytesRead += chunck.length;
  });
  readStream.on("end", function onEnd() {
    callback(null, bytesRead, buffer);
    readStream.destroy();
  });
};

/**
 * Asynchronously reads the entire contents of a file.
 * The callback is passed two arguments `(error, data)`, where data is the
 * contents of the file.
 */
exports.readFile = function readFile(path, encoding, callback) {
  if (isFunction(encoding)) {
    callback = encoding
    encoding = null
  }

  let buffer = new Buffer();
  let readStream = new ReadStream(path);
  readStream.on("data", function(chunck) {
    chunck.copy(buffer, buffer.length);
  });
  readStream.on("error", function onError(error) {
    callback(error);
    readStream.destroy();
  });
  readStream.on("end", function onEnd() {
    callback(null, buffer);
    readStream.destroy();
  });
};

/**
 * Synchronous version of `fs.readFile`. Returns the contents of the path.
 * If encoding is specified then this function returns a string.
 * Otherwise it returns a buffer.
 */
exports.readFileSync = function readFileSync(path, encoding) {
  throw Error("Not implemented");
};

/**
 * Asynchronously writes data to a file, replacing the file if it already
 * exists. data can be a string or a buffer.
 */
exports.writeFile = function writeFile(path, content, encoding, callback) {
  try {
    if (isFunction(encoding)) {
      callback = encoding
      encoding = null
    }
    if (isString(content))
      content = new Buffer(content, encoding);

    let writeStream = new WriteStream(path);
    writeStream.on("error", function onError(error) {
      callback(error);
      writeStream.destroy();
    });
    writeStream.write(content, function onDrain() {
      callback(null);
      writeStream.destroy();
    });
  } catch (error) {
    callback(error);
  }
};
/**
 * The synchronous version of `fs.writeFile`.
 */
exports.writeFileSync = function writeFileSync(filename, data, encoding) {
  throw Error("Not implemented");
};

/**
 * Watch for changes on filename. The callback listener will be called each
 * time the file is accessed.
 *
 * The second argument is optional. The options if provided should be an object
 * containing two members a boolean, persistent, and interval, a polling value
 * in milliseconds. The default is { persistent: true, interval: 0 }.
 */
exports.watchFile = function watchFile(path, options, listener) {
  throw Error("Not implemented");
};
