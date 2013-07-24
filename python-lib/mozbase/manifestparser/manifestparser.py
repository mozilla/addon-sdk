#!/usr/bin/env python

# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.

"""
Mozilla universal manifest parser
"""

__all__ = ['read_ini', # .ini reader
           'ManifestParser', 'TestManifest', 'convert', # manifest handling
           'parse', 'ParseError', 'ExpressionParser'] # conditional expression parser

import os
import re
import shutil
import sys
from fnmatch import fnmatch
from optparse import OptionParser

relpath = os.path.relpath

# expr.py
# from:
# http://k0s.org/mozilla/hg/expressionparser
# http://hg.mozilla.org/users/tmielczarek_mozilla.com/expressionparser

# Implements a top-down parser/evaluator for simple boolean expressions.
# ideas taken from http://effbot.org/zone/simple-top-down-parsing.htm
#
# Rough grammar:
# expr := literal
#       | '(' expr ')'
#       | expr '&&' expr
#       | expr '||' expr
#       | expr '==' expr
#       | expr '!=' expr
# literal := BOOL
#          | INT
#          | STRING
#          | IDENT
# BOOL   := true|false
# INT    := [0-9]+
# STRING := "[^"]*"
# IDENT  := [A-Za-z_]\w*

# Identifiers take their values from a mapping dictionary passed as the second
# argument.

# Glossary (see above URL for details):
# - nud: null denotation
# - led: left detonation
# - lbp: left binding power
# - rbp: right binding power

class ident_token(object):
    def __init__(self, value):
        self.value = value
    def nud(self, parser):
        # identifiers take their value from the value mappings passed
        # to the parser
        return parser.value(self.value)

class literal_token(object):
    def __init__(self, value):
        self.value = value
    def nud(self, parser):
        return self.value

class eq_op_token(object):
    "=="
    def led(self, parser, left):
        return left == parser.expression(self.lbp)

class neq_op_token(object):
    "!="
    def led(self, parser, left):
        return left != parser.expression(self.lbp)

class not_op_token(object):
    "!"
    def nud(self, parser):
        return not parser.expression()

class and_op_token(object):
    "&&"
    def led(self, parser, left):
        right = parser.expression(self.lbp)
        return left and right

class or_op_token(object):
    "||"
    def led(self, parser, left):
        right = parser.expression(self.lbp)
        return left or right

class lparen_token(object):
    "("
    def nud(self, parser):
        expr = parser.expression()
        parser.advance(rparen_token)
        return expr

class rparen_token(object):
    ")"

class end_token(object):
    """always ends parsing"""

### derived literal tokens

class bool_token(literal_token):
    def __init__(self, value):
        value = {'true':True, 'false':False}[value]
        literal_token.__init__(self, value)

class int_token(literal_token):
    def __init__(self, value):
        literal_token.__init__(self, int(value))

class string_token(literal_token):
    def __init__(self, value):
        literal_token.__init__(self, value[1:-1])

precedence = [(end_token, rparen_token),
              (or_op_token,),
              (and_op_token,),
              (eq_op_token, neq_op_token),
              (lparen_token,),
              ]
for index, rank in enumerate(precedence):
    for token in rank:
        token.lbp = index # lbp = lowest left binding power

class ParseError(Exception):
    """errror parsing conditional expression"""

class ExpressionParser(object):
    def __init__(self, text, valuemapping, strict=False):
        """
        Initialize the parser with input |text|, and |valuemapping| as
        a dict mapping identifier names to values.
        """
        self.text = text
        self.valuemapping = valuemapping
        self.strict = strict

    def _tokenize(self):
        """
        Lex the input text into tokens and yield them in sequence.
        """
        # scanner callbacks
        def bool_(scanner, t): return bool_token(t)
        def identifier(scanner, t): return ident_token(t)
        def integer(scanner, t): return int_token(t)
        def eq(scanner, t): return eq_op_token()
        def neq(scanner, t): return neq_op_token()
        def or_(scanner, t): return or_op_token()
        def and_(scanner, t): return and_op_token()
        def lparen(scanner, t): return lparen_token()
        def rparen(scanner, t): return rparen_token()
        def string_(scanner, t): return string_token(t)
        def not_(scanner, t): return not_op_token()

        scanner = re.Scanner([
            (r"true|false", bool_),
            (r"[a-zA-Z_]\w*", identifier),
            (r"[0-9]+", integer),
            (r'("[^"]*")|(\'[^\']*\')', string_),
            (r"==", eq),
            (r"!=", neq),
            (r"\|\|", or_),
            (r"!", not_),
            (r"&&", and_),
            (r"\(", lparen),
            (r"\)", rparen),
            (r"\s+", None), # skip whitespace
            ])
        tokens, remainder = scanner.scan(self.text)
        for t in tokens:
            yield t
        yield end_token()

    def value(self, ident):
        """
        Look up the value of |ident| in the value mapping passed in the
        constructor.
        """
        if self.strict:
            return self.valuemapping[ident]
        else:
            return self.valuemapping.get(ident, None)

    def advance(self, expected):
        """
        Assert that the next token is an instance of |expected|, and advance
        to the next token.
        """
        if not isinstance(self.token, expected):
            raise Exception, "Unexpected token!"
        self.token = self.iter.next()

    def expression(self, rbp=0):
        """
        Parse and return the value of an expression until a token with
        right binding power greater than rbp is encountered.
        """
        t = self.token
        self.token = self.iter.next()
        left = t.nud(self)
        while rbp < self.token.lbp:
            t = self.token
            self.token = self.iter.next()
            left = t.led(self, left)
        return left

    def parse(self):
        """
        Parse and return the value of the expression in the text
        passed to the constructor. Raises a ParseError if the expression
        could not be parsed.
        """
        try:
            self.iter = self._tokenize()
            self.token = self.iter.next()
            return self.expression()
        except:
            raise ParseError("could not parse: %s; variables: %s" % (self.text, self.valuemapping))

    __call__ = parse

def parse(text, **values):
    """
    Parse and evaluate a boolean expression in |text|. Use |values| to look
    up the value of identifiers referenced in the expression. Returns the final
    value of the expression. A ParseError will be raised if parsing fails.
    """
    return ExpressionParser(text, values).parse()

def normalize_path(path):
    """normalize a relative path"""
    if sys.platform.startswith('win'):
        return path.replace('/', os.path.sep)
    return path

def denormalize_path(path):
    """denormalize a relative path"""
    if sys.platform.startswith('win'):
        return path.replace(os.path.sep, '/')
    return path


def read_ini(fp, variables=None, default='DEFAULT',
             comments=';#', separators=('=', ':'),
             strict=True):
    """
    read an .ini file and return a list of [(section, values)]
    - fp : file pointer or path to read
    - variables : default set of variables
    - default : name of the section for the default section
    - comments : characters that if they start a line denote a comment
    - separators : strings that denote key, value separation in order
    - strict : whether to be strict about parsing
    """

    if variables is None:
        variables = {}

    if isinstance(fp, basestring):
        fp = file(fp)

    sections = []
    key = value = None
    section_names = set([])

    # read the lines
    for line in fp.readlines():

        stripped = line.strip()

        # ignore blank lines
        if not stripped:
            # reset key and value to avoid continuation lines
            key = value = None
            continue

        # ignore comment lines
        if stripped[0] in comments:
            continue

        # check for a new section
        if len(stripped) > 2 and stripped[0] == '[' and stripped[-1] == ']':
            section = stripped[1:-1].strip()
            key = value = None

            # deal with DEFAULT section
            if section.lower() == default.lower():
                if strict:
                    assert default not in section_names
                section_names.add(default)
                current_section = variables
                continue

            if strict:
                # make sure this section doesn't already exist
                assert section not in section_names, "Section '%s' already found in '%s'" % (section, section_names)

            section_names.add(section)
            current_section = {}
            sections.append((section, current_section))
            continue

        # if there aren't any sections yet, something bad happen
        if not section_names:
            raise Exception('No sections found')

        # (key, value) pair
        for separator in separators:
            if separator in stripped:
                key, value = stripped.split(separator, 1)
                key = key.strip()
                value = value.strip()

                if strict:
                    # make sure this key isn't already in the section or empty
                    assert key
                    if current_section is not variables:
                        assert key not in current_section

                current_section[key] = value
                break
        else:
            # continuation line ?
            if line[0].isspace() and key:
                value = '%s%s%s' % (value, os.linesep, stripped)
                current_section[key] = value
            else:
                # something bad happen!
                raise Exception("Not sure what you're trying to do")

    # interpret the variables
    def interpret_variables(global_dict, local_dict):
        variables = global_dict.copy()
        variables.update(local_dict)
        return variables

    sections = [(i, interpret_variables(variables, j)) for i, j in sections]
    return sections


### objects for parsing manifests

class ManifestParser(object):
    """read .ini manifests"""

    ### methods for reading manifests

    def __init__(self, manifests=(), defaults=None, strict=True):
        self._defaults = defaults or {}
        self.tests = []
        self.strict = strict
        self.rootdir = None
        self.relativeRoot = None
        if manifests:
            self.read(*manifests)

    def getRelativeRoot(self, root):
        return root

    def _read(self, root, filename, defaults):

        # get directory of this file
        here = os.path.dirname(os.path.abspath(filename))
        defaults['here'] = here

        # read the configuration
        sections = read_ini(fp=filename, variables=defaults, strict=self.strict)

        # get the tests
        for section, data in sections:

            # a file to include
            # TODO: keep track of included file structure:
            # self.manifests = {'manifest.ini': 'relative/path.ini'}
            if section.startswith('include:'):
                include_file = section.split('include:', 1)[-1]
                include_file = normalize_path(include_file)
                if not os.path.isabs(include_file):
                    include_file = os.path.join(self.getRelativeRoot(here), include_file)
                if not os.path.exists(include_file):
                    if self.strict:
                        raise IOError("File '%s' does not exist" % include_file)
                    else:
                        continue
                include_defaults = data.copy()
                self._read(root, include_file, include_defaults)
                continue

            # otherwise an item
            test = data
            test['name'] = section
            test['manifest'] = os.path.abspath(filename)

            # determine the path
            path = test.get('path', section)
            _relpath = path
            if '://' not in path: # don't futz with URLs
                path = normalize_path(path)
                if not os.path.isabs(path):
                    path = os.path.join(here, path)
                _relpath = relpath(path, self.rootdir)

            test['path'] = path
            test['relpath'] = _relpath

            # append the item
            self.tests.append(test)

    def read(self, *filenames, **defaults):

        # ensure all files exist
        missing = [ filename for filename in filenames
                    if not os.path.exists(filename) ]
        if missing:
            raise IOError('Missing files: %s' % ', '.join(missing))

        # process each file
        for filename in filenames:

            # set the per file defaults
            defaults = defaults.copy() or self._defaults.copy()
            here = os.path.dirname(os.path.abspath(filename))
            defaults['here'] = here

            if self.rootdir is None:
                # set the root directory
                # == the directory of the first manifest given
                self.rootdir = here

            self._read(here, filename, defaults)

    ### methods for querying manifests

    def query(self, *checks, **kw):
        """
        general query function for tests
        - checks : callable conditions to test if the test fulfills the query
        """
        tests = kw.get('tests', None)
        if tests is None:
            tests = self.tests
        retval = []
        for test in tests:
            for check in checks:
                if not check(test):
                    break
            else:
                retval.append(test)
        return retval

    def get(self, _key=None, inverse=False, tags=None, tests=None, **kwargs):
        # TODO: pass a dict instead of kwargs since you might hav
        # e.g. 'inverse' as a key in the dict

        # TODO: tags should just be part of kwargs with None values
        # (None == any is kinda weird, but probably still better)

        # fix up tags
        if tags:
            tags = set(tags)
        else:
            tags = set()

        # make some check functions
        if inverse:
            has_tags = lambda test: not tags.intersection(test.keys())
            def dict_query(test):
                for key, value in kwargs.items():
                    if test.get(key) == value:
                        return False
                return True
        else:
            has_tags = lambda test: tags.issubset(test.keys())
            def dict_query(test):
                for key, value in kwargs.items():
                    if test.get(key) != value:
                        return False
                return True

        # query the tests
        tests = self.query(has_tags, dict_query, tests=tests)

        # if a key is given, return only a list of that key
        # useful for keys like 'name' or 'path'
        if _key:
            return [test[_key] for test in tests]

        # return the tests
        return tests

    def missing(self, tests=None):
        """return list of tests that do not exist on the filesystem"""
        if tests is None:
            tests = self.tests
        return [test for test in tests
                if not os.path.exists(test['path'])]

    def manifests(self, tests=None):
        """
        return manifests in order in which they appear in the tests
        """
        if tests is None:
            tests = self.tests
        manifests = []
        for test in tests:
            manifest = test.get('manifest')
            if not manifest:
                continue
            if manifest not in manifests:
                manifests.append(manifest)
        return manifests

    ### methods for outputting from manifests

    def write(self, fp=sys.stdout, rootdir=None,
              global_tags=None, global_kwargs=None,
              local_tags=None, local_kwargs=None):
        """
        write a manifest given a query
        global and local options will be munged to do the query
        globals will be written to the top of the file
        locals (if given) will be written per test
        """

        # root directory
        if rootdir is None:
            rootdir = self.rootdir

        # sanitize input
        global_tags = global_tags or set()
        local_tags = local_tags or set()
        global_kwargs = global_kwargs or {}
        local_kwargs = local_kwargs or {}

        # create the query
        tags = set([])
        tags.update(global_tags)
        tags.update(local_tags)
        kwargs = {}
        kwargs.update(global_kwargs)
        kwargs.update(local_kwargs)

        # get matching tests
        tests = self.get(tags=tags, **kwargs)

        # print the .ini manifest
        if global_tags or global_kwargs:
            print >> fp, '[DEFAULT]'
            for tag in global_tags:
                print >> fp, '%s =' % tag
            for key, value in global_kwargs.items():
                print >> fp, '%s = %s' % (key, value)
            print >> fp

        for test in tests:
            test = test.copy() # don't overwrite

            path = test['name']
            if not os.path.isabs(path):
                path = test['path']
                if self.rootdir:
                    path = relpath(test['path'], self.rootdir)
                path = denormalize_path(path)
            print >> fp, '[%s]' % path

            # reserved keywords:
            reserved = ['path', 'name', 'here', 'manifest', 'relpath']
            for key in sorted(test.keys()):
                if key in reserved:
                    continue
                if key in global_kwargs:
                    continue
                if key in global_tags and not test[key]:
                    continue
                print >> fp, '%s = %s' % (key, test[key])
            print >> fp

    def copy(self, directory, rootdir=None, *tags, **kwargs):
        """
        copy the manifests and associated tests
        - directory : directory to copy to
        - rootdir : root directory to copy to (if not given from manifests)
        - tags : keywords the tests must have
        - kwargs : key, values the tests must match
        """
        # XXX note that copy does *not* filter the tests out of the
        # resulting manifest; it just stupidly copies them over.
        # ideally, it would reread the manifests and filter out the
        # tests that don't match *tags and **kwargs

        # destination
        if not os.path.exists(directory):
            os.path.makedirs(directory)
        else:
            # sanity check
            assert os.path.isdir(directory)

        # tests to copy
        tests = self.get(tags=tags, **kwargs)
        if not tests:
            return # nothing to do!

        # root directory
        if rootdir is None:
            rootdir = self.rootdir

        # copy the manifests + tests
        manifests = [relpath(manifest, rootdir) for manifest in self.manifests()]
        for manifest in manifests:
            destination = os.path.join(directory, manifest)
            dirname = os.path.dirname(destination)
            if not os.path.exists(dirname):
                os.makedirs(dirname)
            else:
                # sanity check
                assert os.path.isdir(dirname)
            shutil.copy(os.path.join(rootdir, manifest), destination)
        for test in tests:
            if os.path.isabs(test['name']):
                continue
            source = test['path']
            if not os.path.exists(source):
                print >> sys.stderr, "Missing test: '%s' does not exist!" % source
                continue
                # TODO: should err on strict
            destination = os.path.join(directory, relpath(test['path'], rootdir))
            shutil.copy(source, destination)
            # TODO: ensure that all of the tests are below the from_dir

    def update(self, from_dir, rootdir=None, *tags, **kwargs):
        """
        update the tests as listed in a manifest from a directory
        - from_dir : directory where the tests live
        - rootdir : root directory to copy to (if not given from manifests)
        - tags : keys the tests must have
        - kwargs : key, values the tests must match
        """

        # get the tests
        tests = self.get(tags=tags, **kwargs)

        # get the root directory
        if not rootdir:
            rootdir = self.rootdir

        # copy them!
        for test in tests:
            if not os.path.isabs(test['name']):
                _relpath = relpath(test['path'], rootdir)
                source = os.path.join(from_dir, _relpath)
                if not os.path.exists(source):
                    # TODO err on strict
                    print >> sys.stderr, "Missing test: '%s'; skipping" % test['name']
                    continue
                destination = os.path.join(rootdir, _relpath)
                shutil.copy(source, destination)


class TestManifest(ManifestParser):
    """
    apply logic to manifests;  this is your integration layer :)
    specific harnesses may subclass from this if they need more logic
    """

    def filter(self, values, tests):
        """
        filter on a specific list tag, e.g.:
        run-if = os == win linux
        skip-if = os == mac
        """

        # tags:
        run_tag = 'run-if'
        skip_tag = 'skip-if'
        fail_tag = 'fail-if'

        # loop over test
        for test in tests:
            reason = None # reason to disable

            # tagged-values to run
            if run_tag in test:
                condition = test[run_tag]
                if not parse(condition, **values):
                    reason = '%s: %s' % (run_tag, condition)

            # tagged-values to skip
            if skip_tag in test:
                condition = test[skip_tag]
                if parse(condition, **values):
                    reason = '%s: %s' % (skip_tag, condition)

            # mark test as disabled if there's a reason
            if reason:
                test.setdefault('disabled', reason)

            # mark test as a fail if so indicated
            if fail_tag in test:
                condition = test[fail_tag]
                if parse(condition, **values):
                    test['expected'] = 'fail'

    def active_tests(self, exists=True, disabled=True, **values):
        """
        - exists : return only existing tests
        - disabled : whether to return disabled tests
        - tags : keys and values to filter on (e.g. `os = linux mac`)
        """

        tests = [i.copy() for i in self.tests] # shallow copy

        # mark all tests as passing unless indicated otherwise
        for test in tests:
            test['expected'] = test.get('expected', 'pass')

        # ignore tests that do not exist
        if exists:
            tests = [test for test in tests if os.path.exists(test['path'])]

        # filter by tags
        self.filter(values, tests)

        # ignore disabled tests if specified
        if not disabled:
            tests = [test for test in tests
                     if not 'disabled' in test]

        # return active tests
        return tests

    def test_paths(self):
        return [test['path'] for test in self.active_tests()]


### utility function(s); probably belongs elsewhere

def convert(directories, pattern=None, ignore=(), write=None):
    """
    convert directories to a simple manifest
    """

    retval = []
    include = []
    for directory in directories:
        for dirpath, dirnames, filenames in os.walk(directory):

            # filter out directory names
            dirnames = [ i for i in dirnames if i not in ignore ]
            dirnames.sort()

            # reference only the subdirectory
            _dirpath = dirpath
            dirpath = dirpath.split(directory, 1)[-1].strip(os.path.sep)

            if dirpath.split(os.path.sep)[0] in ignore:
                continue

            # filter by glob
            if pattern:
                filenames = [filename for filename in filenames
                             if fnmatch(filename, pattern)]

            filenames.sort()

            # write a manifest for each directory
            if write and (dirnames or filenames):
                manifest = file(os.path.join(_dirpath, write), 'w')
                for dirname in dirnames:
                    print >> manifest, '[include:%s]' % os.path.join(dirname, write)
                for filename in filenames:
                    print >> manifest, '[%s]' % filename
                manifest.close()

            # add to the list
            retval.extend([denormalize_path(os.path.join(dirpath, filename))
                           for filename in filenames])

    if write:
        return # the manifests have already been written!

    retval.sort()
    retval = ['[%s]' % filename for filename in retval]
    return '\n'.join(retval)

### command line attributes

class ParserError(Exception):
  """error for exceptions while parsing the command line"""

def parse_args(_args):
    """
    parse and return:
    --keys=value (or --key value)
    -tags
    args
    """

    # return values
    _dict = {}
    tags = []
    args = []

    # parse the arguments
    key = None
    for arg in _args:
        if arg.startswith('---'):
            raise ParserError("arguments should start with '-' or '--' only")
        elif arg.startswith('--'):
            if key:
                raise ParserError("Key %s still open" % key)
            key = arg[2:]
            if '=' in key:
                key, value = key.split('=', 1)
                _dict[key] = value
                key = None
                continue
        elif arg.startswith('-'):
            if key:
                raise ParserError("Key %s still open" % key)
            tags.append(arg[1:])
            continue
        else:
            if key:
                _dict[key] = arg
                continue
            args.append(arg)

    # return values
    return (_dict, tags, args)


### classes for subcommands

class CLICommand(object):
    usage = '%prog [options] command'
    def __init__(self, parser):
      self._parser = parser # master parser
    def parser(self):
      return OptionParser(usage=self.usage, description=self.__doc__,
                          add_help_option=False)

class Copy(CLICommand):
    usage = '%prog [options] copy manifest directory -tag1 -tag2 --key1=value1 --key2=value2 ...'
    def __call__(self, options, args):
      # parse the arguments
      try:
        kwargs, tags, args = parse_args(args)
      except ParserError, e:
        self._parser.error(e.message)

      # make sure we have some manifests, otherwise it will
      # be quite boring
      if not len(args) == 2:
        HelpCLI(self._parser)(options, ['copy'])
        return

      # read the manifests
      # TODO: should probably ensure these exist here
      manifests = ManifestParser()
      manifests.read(args[0])

      # print the resultant query
      manifests.copy(args[1], None, *tags, **kwargs)


class CreateCLI(CLICommand):
    """
    create a manifest from a list of directories
    """
    usage = '%prog [options] create directory <directory> <...>'

    def parser(self):
        parser = CLICommand.parser(self)
        parser.add_option('-p', '--pattern', dest='pattern',
                          help="glob pattern for files")
        parser.add_option('-i', '--ignore', dest='ignore',
                          default=[], action='append',
                          help='directories to ignore')
        parser.add_option('-w', '--in-place', dest='in_place',
                          help='Write .ini files in place; filename to write to')
        return parser

    def __call__(self, _options, args):
        parser = self.parser()
        options, args = parser.parse_args(args)

        # need some directories
        if not len(args):
            parser.print_usage()
            return

        # add the directories to the manifest
        for arg in args:
            assert os.path.exists(arg)
            assert os.path.isdir(arg)
            manifest = convert(args, pattern=options.pattern, ignore=options.ignore,
                               write=options.in_place)
        if manifest:
            print manifest


class WriteCLI(CLICommand):
    """
    write a manifest based on a query
    """
    usage = '%prog [options] write manifest <manifest> -tag1 -tag2 --key1=value1 --key2=value2 ...'
    def __call__(self, options, args):

        # parse the arguments
        try:
            kwargs, tags, args = parse_args(args)
        except ParserError, e:
            self._parser.error(e.message)

        # make sure we have some manifests, otherwise it will
        # be quite boring
        if not args:
            HelpCLI(self._parser)(options, ['write'])
            return

        # read the manifests
        # TODO: should probably ensure these exist here
        manifests = ManifestParser()
        manifests.read(*args)

        # print the resultant query
        manifests.write(global_tags=tags, global_kwargs=kwargs)


class HelpCLI(CLICommand):
    """
    get help on a command
    """
    usage = '%prog [options] help [command]'

    def __call__(self, options, args):
        if len(args) == 1 and args[0] in commands:
            commands[args[0]](self._parser).parser().print_help()
        else:
            self._parser.print_help()
            print '\nCommands:'
            for command in sorted(commands):
                print '  %s : %s' % (command, commands[command].__doc__.strip())

class UpdateCLI(CLICommand):
    """
    update the tests as listed in a manifest from a directory
    """
    usage = '%prog [options] update manifest directory -tag1 -tag2 --key1=value1 --key2=value2 ...'

    def __call__(self, options, args):
        # parse the arguments
        try:
            kwargs, tags, args = parse_args(args)
        except ParserError, e:
            self._parser.error(e.message)

        # make sure we have some manifests, otherwise it will
        # be quite boring
        if not len(args) == 2:
            HelpCLI(self._parser)(options, ['update'])
            return

        # read the manifests
        # TODO: should probably ensure these exist here
        manifests = ManifestParser()
        manifests.read(args[0])

        # print the resultant query
        manifests.update(args[1], None, *tags, **kwargs)


# command -> class mapping
commands = { 'create': CreateCLI,
             'help': HelpCLI,
             'update': UpdateCLI,
             'write': WriteCLI }

def main(args=sys.argv[1:]):
    """console_script entry point"""

    # set up an option parser
    usage = '%prog [options] [command] ...'
    description = "%s. Use `help` to display commands" % __doc__.strip()
    parser = OptionParser(usage=usage, description=description)
    parser.add_option('-s', '--strict', dest='strict',
                      action='store_true', default=False,
                      help='adhere strictly to errors')
    parser.disable_interspersed_args()

    options, args = parser.parse_args(args)

    if not args:
        HelpCLI(parser)(options, args)
        parser.exit()

    # get the command
    command = args[0]
    if command not in commands:
        parser.error("Command must be one of %s (you gave '%s')" % (', '.join(sorted(commands.keys())), command))

    handler = commands[command](parser)
    handler(options, args[1:])

if __name__ == '__main__':
    main()
