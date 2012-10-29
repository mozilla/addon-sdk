// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.


// Adapted version of:
// https://github.com/joyent/node/blob/v0.9.1/test/simple/test-path.js

exports['test path'] = function(assert) {

var system = require('sdk/system');
var path = require('sdk/fs/path');
var isWindows = require('sdk/system').platform.indexOf('win') === 0;


// POSIX filenames may include control characters
// c.f. http://www.dwheeler.com/essays/fixing-unix-linux-filenames.html
if (!isWindows) {
  var controlCharFilename = 'Icon' + String.fromCharCode(13);
  assert.equal(path.basename('/a/b/' + controlCharFilename),
               controlCharFilename);
}


assert.equal(path.dirname('/a/b/'), '/a');
assert.equal(path.dirname('/a/b'), '/a');
assert.equal(path.dirname('/a'), '/');
assert.equal(path.dirname('/'), '/');

if (isWindows) {
  assert.equal(path.dirname('c:\\'), 'c:\\');
  assert.equal(path.dirname('c:\\foo'), 'c:\\');
  assert.equal(path.dirname('c:\\foo\\'), 'c:\\');
  assert.equal(path.dirname('c:\\foo\\bar'), 'c:\\foo');
  assert.equal(path.dirname('c:\\foo\\bar\\'), 'c:\\foo');
  assert.equal(path.dirname('c:\\foo\\bar\\baz'), 'c:\\foo\\bar');
  assert.equal(path.dirname('\\'), '\\');
  assert.equal(path.dirname('\\foo'), '\\');
  assert.equal(path.dirname('\\foo\\'), '\\');
  assert.equal(path.dirname('\\foo\\bar'), '\\foo');
  assert.equal(path.dirname('\\foo\\bar\\'), '\\foo');
  assert.equal(path.dirname('\\foo\\bar\\baz'), '\\foo\\bar');
  assert.equal(path.dirname('c:'), 'c:');
  assert.equal(path.dirname('c:foo'), 'c:');
  assert.equal(path.dirname('c:foo\\'), 'c:');
  assert.equal(path.dirname('c:foo\\bar'), 'c:foo');
  assert.equal(path.dirname('c:foo\\bar\\'), 'c:foo');
  assert.equal(path.dirname('c:foo\\bar\\baz'), 'c:foo\\bar');
  assert.equal(path.dirname('\\\\unc\\share'), '\\\\unc\\share');
  assert.equal(path.dirname('\\\\unc\\share\\foo'), '\\\\unc\\share\\');
  assert.equal(path.dirname('\\\\unc\\share\\foo\\'), '\\\\unc\\share\\');
  assert.equal(path.dirname('\\\\unc\\share\\foo\\bar'),
               '\\\\unc\\share\\foo');
  assert.equal(path.dirname('\\\\unc\\share\\foo\\bar\\'),
               '\\\\unc\\share\\foo');
  assert.equal(path.dirname('\\\\unc\\share\\foo\\bar\\baz'),
               '\\\\unc\\share\\foo\\bar');
}


assert.equal(path.extname(''), '');
assert.equal(path.extname('/path/to/file'), '');
assert.equal(path.extname('/path/to/file.ext'), '.ext');
assert.equal(path.extname('/path.to/file.ext'), '.ext');
assert.equal(path.extname('/path.to/file'), '');
assert.equal(path.extname('/path.to/.file'), '');
assert.equal(path.extname('/path.to/.file.ext'), '.ext');
assert.equal(path.extname('/path/to/f.ext'), '.ext');
assert.equal(path.extname('/path/to/..ext'), '.ext');
assert.equal(path.extname('file'), '');
assert.equal(path.extname('file.ext'), '.ext');
assert.equal(path.extname('.file'), '');
assert.equal(path.extname('.file.ext'), '.ext');
assert.equal(path.extname('/file'), '');
assert.equal(path.extname('/file.ext'), '.ext');
assert.equal(path.extname('/.file'), '');
assert.equal(path.extname('/.file.ext'), '.ext');
assert.equal(path.extname('.path/file.ext'), '.ext');
assert.equal(path.extname('file.ext.ext'), '.ext');
assert.equal(path.extname('file.'), '.');
assert.equal(path.extname('.'), '');
assert.equal(path.extname('./'), '');
assert.equal(path.extname('.file.ext'), '.ext');
assert.equal(path.extname('.file'), '');
assert.equal(path.extname('.file.'), '.');
assert.equal(path.extname('.file..'), '.');
assert.equal(path.extname('..'), '');
assert.equal(path.extname('../'), '');
assert.equal(path.extname('..file.ext'), '.ext');
assert.equal(path.extname('..file'), '.file');
assert.equal(path.extname('..file.'), '.');
assert.equal(path.extname('..file..'), '.');
assert.equal(path.extname('...'), '.');
assert.equal(path.extname('...ext'), '.ext');
assert.equal(path.extname('....'), '.');
assert.equal(path.extname('file.ext/'), '');

if (isWindows) {
  // On windows, backspace is a path separator.
  assert.equal(path.extname('.\\'), '');
  assert.equal(path.extname('..\\'), '');
  assert.equal(path.extname('file.ext\\'), '');
} else {
  // On unix, backspace is a valid name component like any other character.
  assert.equal(path.extname('.\\'), '');
  assert.equal(path.extname('..\\'), '.\\');
  assert.equal(path.extname('file.ext\\'), '.ext\\');
}

// path.join tests
var failures = [];
var joinTests =
    // arguments                     result
    [[['.', 'x/b', '..', '/b/c.js'], 'x/b/c.js'],
     [['/.', 'x/b', '..', '/b/c.js'], '/x/b/c.js'],
     [['/foo', '../../../bar'], '/bar'],
     [['foo', '../../../bar'], '../../bar'],
     [['foo/', '../../../bar'], '../../bar'],
     [['foo/x', '../../../bar'], '../bar'],
     [['foo/x', './bar'], 'foo/x/bar'],
     [['foo/x/', './bar'], 'foo/x/bar'],
     [['foo/x/', '.', 'bar'], 'foo/x/bar'],
     [['./'], './'],
     [['.', './'], './'],
     [['.', '.', '.'], '.'],
     [['.', './', '.'], '.'],
     [['.', '/./', '.'], '.'],
     [['.', '/////./', '.'], '.'],
     [['.'], '.'],
     [['', '.'], '.'],
     [['', 'foo'], 'foo'],
     [['foo', '/bar'], 'foo/bar'],
     [['', '/foo'], '/foo'],
     [['', '', '/foo'], '/foo'],
     [['', '', 'foo'], 'foo'],
     [['foo', ''], 'foo'],
     [['foo/', ''], 'foo/'],
     [['foo', '', '/bar'], 'foo/bar'],
     [['./', '..', '/foo'], '../foo'],
     [['./', '..', '..', '/foo'], '../../foo'],
     [['.', '..', '..', '/foo'], '../../foo'],
     [['', '..', '..', '/foo'], '../../foo'],
     [['/'], '/'],
     [['/', '.'], '/'],
     [['/', '..'], '/'],
     [['/', '..', '..'], '/'],
     [[''], '.'],
     [['', ''], '.'],
     [[' /foo'], ' /foo'],
     [[' ', 'foo'], ' /foo'],
     [[' ', '.'], ' '],
     [[' ', '/'], ' /'],
     [[' ', ''], ' '],
     // filtration of non-strings.
     [['x', true, 7, 'y', null, {}], 'x/y']
    ];
joinTests.forEach(function(test) {
  var actual = path.join.apply(path, test[0]);
  var expected = isWindows ? test[1].replace(/\//g, '\\') : test[1];
  var message = 'path.join(' + test[0].map(JSON.stringify).join(',') + ')' +
                '\n  expect=' + JSON.stringify(expected) +
                '\n  actual=' + JSON.stringify(actual);
  if (actual !== expected) failures.push('\n' + message);
  // assert.equal(actual, expected, message);
});
assert.equal(failures.length, 0, failures.join(''));

// path normalize tests
if (isWindows) {
  assert.equal(path.normalize('./fixtures///b/../b/c.js'),
               'fixtures\\b\\c.js');
  assert.equal(path.normalize('/foo/../../../bar'), '\\bar');
  assert.equal(path.normalize('a//b//../b'), 'a\\b');
  assert.equal(path.normalize('a//b//./c'), 'a\\b\\c');
  assert.equal(path.normalize('a//b//.'), 'a\\b');
  assert.equal(path.normalize('//server/share/dir/file.ext'),
               '\\\\server\\share\\dir\\file.ext');
} else {
  assert.equal(path.normalize('./fixtures///b/../b/c.js'),
               'fixtures/b/c.js');
  assert.equal(path.normalize('/foo/../../../bar'), '/bar');
  assert.equal(path.normalize('a//b//../b'), 'a/b');
  assert.equal(path.normalize('a//b//./c'), 'a/b/c');
  assert.equal(path.normalize('a//b//.'), 'a/b');
}

// path.resolve tests
if (isWindows) {
  // windows
  var resolveTests =
      // arguments                                    result
      [[['c:/blah\\blah', 'd:/games', 'c:../a'], 'c:\\blah\\a'],
       [['c:/ignore', 'd:\\a/b\\c/d', '\\e.exe'], 'd:\\e.exe'],
       [['c:/ignore', 'c:/some/file'], 'c:\\some\\file'],
       [['d:/ignore', 'd:some/dir//'], 'd:\\ignore\\some\\dir'],
       [['.'], system.pathFor('CurProcD')],
       [['//server/share', '..', 'relative\\'], '\\\\server\\share\\relative']];
} else {
  // Posix
  var resolveTests =
      // arguments                                    result
      [[['/var/lib', '../', 'file/'], '/var/file'],
       [['/var/lib', '/../', 'file/'], '/file'],
       [['a/b/c/', '../../..'], system.pathFor('CurProcD')],
       [['.'], system.pathFor('CurProcD')],
       [['/some/dir', '.', '/absolute/'], '/absolute']];
}
var failures = [];
resolveTests.forEach(function(test) {
  var actual = path.resolve.apply(path, test[0]);
  var expected = test[1];
  var message = 'path.resolve(' + test[0].map(JSON.stringify).join(',') + ')' +
                '\n  expect=' + JSON.stringify(expected) +
                '\n  actual=' + JSON.stringify(actual);
  if (actual !== expected) failures.push('\n' + message);
  // assert.equal(actual, expected, message);
});
assert.equal(failures.length, 0, failures.join(''));

// path.relative tests
if (isWindows) {
  // windows
  var relativeTests =
      // arguments                     result
      [['c:/blah\\blah', 'd:/games', 'd:\\games'],
       ['c:/aaaa/bbbb', 'c:/aaaa', '..'],
       ['c:/aaaa/bbbb', 'c:/cccc', '..\\..\\cccc'],
       ['c:/aaaa/bbbb', 'c:/aaaa/bbbb', ''],
       ['c:/aaaa/bbbb', 'c:/aaaa/cccc', '..\\cccc'],
       ['c:/aaaa/', 'c:/aaaa/cccc', 'cccc'],
       ['c:/', 'c:\\aaaa\\bbbb', 'aaaa\\bbbb'],
       ['c:/aaaa/bbbb', 'd:\\', 'd:\\']];
} else {
  // posix
  var relativeTests =
      // arguments                    result
      [['/var/lib', '/var', '..'],
       ['/var/lib', '/bin', '../../bin'],
       ['/var/lib', '/var/lib', ''],
       ['/var/lib', '/var/apache', '../apache'],
       ['/var/', '/var/lib', 'lib'],
       ['/', '/var/lib', 'var/lib']];
}
var failures = [];
relativeTests.forEach(function(test) {
  var actual = path.relative(test[0], test[1]);
  var expected = test[2];
  var message = 'path.relative(' +
                test.slice(0, 2).map(JSON.stringify).join(',') +
                ')' +
                '\n  expect=' + JSON.stringify(expected) +
                '\n  actual=' + JSON.stringify(actual);
  if (actual !== expected) failures.push('\n' + message);
});
assert.equal(failures.length, 0, failures.join(''));

// path.sep tests
if (isWindows) {
    // windows
    assert.equal(path.sep, '\\');
} else {
    // posix
    assert.equal(path.sep, '/');
}

};

require('test').run(exports);
