
import os, sys, re, hashlib
import simplejson as json
SEP = os.path.sep

def js_zipname(packagename, modulename):
    return "%s-lib/%s.js" % (packagename, modulename)
def docs_zipname(packagename, modulename):
    return "%s-docs/%s.md" % (packagename, modulename)
def datamap_zipname(packagename):
    return "%s-data.json" % packagename
def datafile_zipname(packagename, datapath):
    return "%s-data/%s" % (packagename, datapath)

def to_json(o):
    return json.dumps(o, indent=1).encode("utf-8")+"\n"

class BadModuleIdentifier(Exception):
    pass
class BadSection(Exception):
    pass

class ManifestEntry:
    def __init__(self):
        self.docs_filename = None
        self.docs_hash = None
        self.requirements = {}
        self.datamap = None

    def get_uri(self, prefix):
        return "%s%s-%s/%s.js" % \
               (prefix, self.packageName, self.sectionName, self.moduleName)

    def get_entry_for_manifest(self, prefix):
        entry = { "packageName": self.packageName,
                  "sectionName": self.sectionName,
                  "moduleName": self.moduleName,
                  "jsSHA256": self.js_hash,
                  "docsSHA256": self.docs_hash,
                  "requirements": {},
                  }
        for req in self.requirements:
            if self.requirements[req]:
                them = self.requirements[req] # this is another ManifestEntry
                them_uri = them.get_uri(prefix)
                entry["requirements"][req] = {"uri": them_uri}
            else:
                # something magic. The manifest entry indicates that they're
                # allowed to require() it
                entry["requirements"][req] = {}
        if self.datamap:
            entry["requirements"]["self"] = {
                "mapSHA256": self.datamap.data_manifest_hash,
                "mapName": self.packageName+"-data",
                "dataURIPrefix": "%s%s-data/" % (prefix, self.packageName),
                }
        return entry

    def add_js(self, js_filename):
        self.js_filename = js_filename
        self.js_hash = hash_file(js_filename)
    def add_docs(self, docs_filename):
        self.docs_filename = docs_filename
        self.docs_hash = hash_file(docs_filename)
    def add_requirement(self, reqname, reqdata):
        self.requirements[reqname] = reqdata
    def add_data(self, datamap):
        self.datamap = datamap

    def get_js_zipname(self):
        return js_zipname(self.packagename, self.modulename)
    def get_docs_zipname(self):
        if self.docs_hash:
            return docs_zipname(self.packagename, self.modulename)
        return None
    # self.js_filename
    # self.docs_filename


def hash_file(fn):
    return hashlib.sha256(open(fn,"rb").read()).hexdigest()

# things to ignore in data/ directories
IGNORED_FILES = [".hgignore"]
IGNORED_FILE_SUFFIXES = ["~"]
IGNORED_DIRS = [".svn", ".hg", "defaults"]

def filter_filenames(filenames):
    for filename in filenames:
        if filename in IGNORED_FILES:
            continue
        if any([filename.endswith(suffix)
                for suffix in IGNORED_FILE_SUFFIXES]):
            continue
        yield filename

def get_datafiles(datadir):
    # yields pathnames relative to DATADIR, ignoring some files
    for dirpath, dirnames, filenames in os.walk(datadir):
        filenames = list(filter_filenames(filenames))
        # this tells os.walk to prune the search
        dirnames[:] = [dirname for dirname in dirnames
                       if dirname not in IGNORED_DIRS]
        for filename in filenames:
            fullname = os.path.join(dirpath, filename)
            assert fullname.startswith(datadir+SEP), "%s%s not in %s" % (datadir, SEP, fullname)
            yield fullname[len(datadir+SEP):]


class DataMap:
    # one per package
    def __init__(self, pkg, uri_prefix):
        self.pkg = pkg
        self.name = pkg.name
        self.files_to_copy = []
        datamap = {}
        datadir = os.path.join(pkg.root_dir, "data")
        for dataname in get_datafiles(datadir):
            absname = os.path.join(datadir, dataname)
            zipname = datafile_zipname(pkg.name, dataname)
            datamap[dataname] = hash_file(absname)
            self.files_to_copy.append( (zipname, absname) )
        self.data_manifest = to_json(datamap)
        self.data_manifest_hash = hashlib.sha256(self.data_manifest).hexdigest()
        self.data_manifest_zipname = datamap_zipname(pkg.name)
        self.data_uri_prefix = "%s%s-data/" % (uri_prefix, self.name)

class BadChromeMarkerError(Exception):
    pass

class ModuleInfo:
    def __init__(self, package, section, name, js, docs):
        self.package = package
        self.section = section
        self.name = name
        self.js = js
        self.docs = docs

    def __hash__(self):
        return hash( (self.package.name, self.section, self.name,
                      self.js, self.docs) )
    def __eq__(self, them):
        if them.__class__ is not self.__class__:
            return False
        if ((them.package.name, them.section, them.name, them.js, them.docs) !=
            (self.package.name, self.section, self.name, self.js, self.docs) ):
            return False
        return True

    def __repr__(self):
        return "ModuleInfo [%s %s %s] (%s, %s)" % (self.package.name,
                                                   self.section,
                                                   self.name,
                                                   self.js, self.docs)

class ManifestBuilder:
    def __init__(self, target_cfg, pkg_cfg, deps, uri_prefix,
                 stderr=sys.stderr):
        self.manifest = {} # maps (package,section,module) to ManifestEntry
        self.target_cfg = target_cfg # the entry point
        self.pkg_cfg = pkg_cfg # all known packages
        self.deps = deps # list of package names to search
        self.used_packagenames = set()
        self.stderr = stderr
        self.uri_prefix = uri_prefix
        self.modules = {} # maps ModuleInfo to URI in self.manifest
        self.datamaps = {} # maps package name to DataMap instance
        self.files = [] # maps manifest index to (absfn,absfn) js/docs pair

    def build(self, scan_tests):
        # process the top module, which recurses to process everything it
        # reaches
        if "main" in self.target_cfg:
            self.top_uri = self.process_module(self.find_top(self.target_cfg))
        if scan_tests:
            # also scan all test files in all packages that we use
            for packagename in self.used_packagenames:
                package = self.pkg_cfg.packages[packagename]
                dirnames = package["tests"]
                if isinstance(dirnames, basestring):
                    dirnames = [dirnames]
                dirnames = [os.path.join(package.root_dir, d) for d in dirnames]
                for d in dirnames:
                    for tname in os.listdir(d):
                        if tname.startswith("test-") and tname.endswith(".js"):
                            #re.search(r'^test-.*\.js$', tname):
                            tmi = ModuleInfo(package, "tests", tname[:-3],
                                             os.path.join(d, tname), None)
                            self.process_module(tmi)

    def get_module_entries(self):
        return frozenset(self.manifest.values())
    def get_data_entries(self):
        return frozenset(self.datamaps.values())

    def get_harness_options_manifest(self, uri_prefix):
        manifest = {}
        for me in self.get_module_entries():
            uri = me.get_uri(uri_prefix)
            manifest[uri] = me.get_entry_for_manifest(uri_prefix)
        return manifest

    def get_manifest_entry(self, package, section, module):
        index = (package, section, module)
        if index not in self.manifest:
            m = self.manifest[index] = ManifestEntry()
            m.packageName = package
            m.sectionName = section
            m.moduleName = module
            self.used_packagenames.add(package)
        return self.manifest[index]

    def find_top(self, target_cfg):
        for libdir in target_cfg.lib:
            n = os.path.join(target_cfg.root_dir, libdir, target_cfg.main+".js")
            if os.path.exists(n):
                top_js = n
                break
        else:
            raise KeyError("unable to find main module '%s.js' in top-level package" % target_cfg.main)
        n = os.path.join(target_cfg.root_dir, "README.md")
        if os.path.exists(n):
            top_docs = n
        else:
            top_docs = None
        return ModuleInfo(target_cfg, "lib", target_cfg.main, top_js, top_docs)

    def process_module(self, mi):
        pkg = mi.package
        #print "ENTERING", pkg.name, mi.name
        # mi.name must be fully-qualified
        assert (not mi.name.startswith("./") and
                not mi.name.startswith("../"))
        # create and claim the manifest row first
        me = self.get_manifest_entry(pkg.name, mi.section, mi.name)

        me.add_js(mi.js)
        if mi.docs:
            me.add_docs(mi.docs)

        js_lines = open(mi.js,"r").readlines()
        requires, problems = scan_module(mi.js, js_lines, self.stderr)
        if problems:
            # the relevant instructions have already been written to stderr
            raise BadChromeMarkerError()

        # We update our requirements on the way out of the depth-first
        # traversal of the module graph

        for reqname in sorted(requires.keys()):
            if reqname in ("chrome", "parent-loader", "loader", "manifest"):
                me.add_requirement(reqname, None)
            elif reqname == "self":
                # this might reference bundled data, so:
                #  1: hash that data, add the hash as a dependency
                #  2: arrange for the data to be copied into the XPI later
                if pkg.name not in self.datamaps:
                    self.datamaps[pkg.name] = DataMap(pkg, self.uri_prefix)
                dm = self.datamaps[pkg.name]
                me.add_data(dm) # 'self' is implicit
            else:
                # when two modules require() the same name, do they get a
                # shared instance? This is a deep question. For now say yes.

                # find_req_for() returns an entry to put in our
                # 'requirements' dict, and will recursively process
                # everything transitively required from here. It will also
                # populate the self.modules[] cache. Note that we must
                # tolerate cycles in the reference graph.
                them_me = self.find_req_for(mi, reqname)
                if them_me is None:
                    #raise BadModuleIdentifier("unable to satisfy require(%s) from %s" % (reqname, mi))
                    print "Warning: unable to satisfy require(%s) from %s" % (reqname, mi)
                else:
                    me.add_requirement(reqname, them_me)

        return me
        #print "LEAVING", pkg.name, mi.name

    def find_req_for(self, from_module, reqname): #, pkg, modulename):
        # handle a single require(reqname) statement from from_module .
        # Return a uri that exists in self.manifest
        def BAD(msg):
            return BadModuleIdentifier(msg + " in require(%s) from %s" %
                                       (reqname, from_module))

        if not reqname:
            raise BAD("no actual modulename")

        # Allow things in tests/*.js to require both test code and real code.
        # But things in lib/*.js can only require real code.
        if from_module.section == "tests":
            lookfor_sections = ["tests", "lib"]
        elif from_module.section == "lib":
            lookfor_sections = ["lib"]
        else:
            raise BadSection(from_module.section)
        modulename = from_module.name

        #print " %s require(%s))" % (from_module, reqname)
        bits = reqname.split("/")

        if reqname.startswith("./") or reqname.startswith("../"):
            # 1: they want something relative to themselves, always from
            # their own package
            lookfor_pkg = from_module.package.name
            them = modulename.split("/")[:-1]
            while bits[0] in (".", ".."):
                if not bits:
                    raise BAD("no actual modulename")
                if bits[0] == "..":
                    if not them:
                        raise BAD("too many ..")
                    them.pop()
                bits.pop(0)
            bits = them+bits
            lookfor_mod = "/".join(bits)
            return self._get_module(lookfor_pkg, lookfor_sections, lookfor_mod)

        # non-relative import. Might be a short name (requiring a search
        # through "library" packages), or a fully-qualified one.

        if "/" in reqname:
            # 2: PKG/MOD: find PKG, look inside for MOD
            lookfor_pkg = bits[0]
            lookfor_mod = "/".join(bits[1:])
            mi = self._get_module(lookfor_pkg, lookfor_sections, lookfor_mod)
            if mi: # caution, 0==None
                return mi

        # 3: try finding MOD or MODPARENT/MODCHILD in their own package
        from_pkg = from_module.package.name
        mi = self._get_module(from_pkg, lookfor_sections, reqname)
        if mi:
            return mi

        # 4: try finding PKG, if found, use its main.js entry point
        if "/" not in reqname:
            mi = self._get_module(reqname, lookfor_sections, None)
            if mi:
                return mi

        # 5: MOD: search "library" packages for one that exports MOD
        return self._get_module(None, lookfor_sections, reqname)


    def _get_module(self, pkgname, sections, modname):
        # pkgname could be None, which means "search library packages"

        mi = self._find_module(pkgname, sections, modname)
        if not mi:
            return None

        # we tolerate cycles in the reference graph, which means we need to
        # populate the self.modules cache before recursing into
        # process_module() . We must also check the cache first, so recursion
        # can terminate.
        pkgname = mi.package.name
        if mi in self.modules:
            # we didn't know the packagename before
            return self.modules[mi]

        # this creates the entry
        new_entry = self.get_manifest_entry(pkgname, mi.section, mi.name)
        # and populates the cache
        self.modules[mi] = new_entry
        self.process_module(mi)
        return new_entry

    def _find_module(self, pkgname, sections, modname):
        #print "   _find_module(%s %s %s)" % (pkgname, sections, modname)
        if pkgname:
            if pkgname not in self.pkg_cfg.packages:
                return None
            if not modname:
                #print " cannot handle modname=None yet"
                return None
            return self._find_module_in_package(pkgname, sections, modname)
        # search library packages. For now, search all packages.
        for pkgname in self.deps:
            mi = self._find_module_in_package(pkgname, sections, modname)
            if mi:
                return mi
        return None

    def _find_module_in_package(self, pkgname, sections, name):
        pkg = self.pkg_cfg.packages[pkgname]
        if isinstance(sections, basestring):
            sections = [sections]
        for section in sections:
            for sdir in pkg.get(section, []):
                js = os.path.join(pkg.root_dir, sdir, name+".js")
                if os.path.exists(js):
                    docs = None
                    maybe_docs = os.path.join(pkg.root_dir, "docs", name+".md")
                    if section == "lib" and os.path.exists(maybe_docs):
                        docs = maybe_docs
                    return ModuleInfo(pkg, section, name, js, docs)
        return None

def build_manifest(target_cfg, pkg_cfg, deps, uri_prefix, scan_tests):
    """
    Perform recursive dependency analysis starting from entry_point,
    building up a manifest of modules that need to be included in the XPI.
    Each entry will map require() names to the URL of the module that will
    be used to satisfy that dependency. The manifest will be used by the
    runtime's require() code.

    This returns a ManifestBuilder object, with two public methods. The
    first, get_module_entries(), returns a set of ManifestEntry objects, each
    of which can be asked for the following:

     * its contribution to the harness-options.json '.manifest'
     * the local disk name
     * the name in the XPI at which it should be placed

    The second is get_data_entries(), which returns a set of DataEntry
    objects, each of which has:

     * local disk name
     * name in the XPI

    note: we don't build the XPI here, but our manifest is passed to the
    code which does, so it knows what to copy into the XPI.
    """

    mxt = ManifestBuilder(target_cfg, pkg_cfg, deps, uri_prefix)
    mxt.build(scan_tests)
    return mxt



COMMENT_PREFIXES = ["//", "/*", "*", "\'", "\"", "dump("]

REQUIRE_RE = r"(?<![\'\"])require\s*\(\s*[\'\"]([^\'\"]+?)[\'\"]\s*\)"

# detect the define idiom of the form:
#   define("module name", ["dep1", "dep2", "dep3"], function() {})
# by capturing the contents of the list in a group.
DEF_RE = re.compile(r"(require|define)\s*\(\s*([\'\"][^\'\"]+[\'\"]\s*,)?\s*\[([^\]]+)\]")

# Out of the async dependencies, do not allow quotes in them.
DEF_RE_ALLOWED = re.compile(r"^[\'\"][^\'\"]+[\'\"]$")

def scan_requirements_with_grep(fn, lines):
    requires = {}
    for line in lines:
        for clause in line.split(";"):
            clause = clause.strip()
            iscomment = False
            for commentprefix in COMMENT_PREFIXES:
                if clause.startswith(commentprefix):
                    iscomment = True
            if iscomment:
                continue
            mo = re.search(REQUIRE_RE, clause)
            if mo:
                modname = mo.group(1)
                requires[modname] = {}

    # define() can happen across multiple lines, so join everyone up.
    wholeshebang = "\n".join(lines)
    for match in DEF_RE.finditer(wholeshebang):
        # this should net us a list of string literals separated by commas
        for strbit in match.group(3).split(","):
            strbit = strbit.strip()
            # There could be a trailing comma netting us just whitespace, so
            # filter that out. Make sure that only string values with
            # quotes around them are allowed, and no quotes are inside
            # the quoted value.
            if strbit and DEF_RE_ALLOWED.match(strbit):
                modname = strbit[1:-1]
                if modname not in ["exports"]:
                    requires[modname] = {}

    return requires

MUST_ASK_FOR_CHROME =  """\
To use chrome authority, as in line %d in:
 %s
 > %s
You must enable it with:
  let {Cc,Ci,Cu,Cr,Cm} = require('chrome');
"""

CHROME_ALIASES = ["Cc", "Ci", "Cu", "Cr", "Cm"]

def scan_chrome(fn, lines, stderr):
    filename = os.path.basename(fn)
    if filename == "cuddlefish.js" or filename == "securable-module.js":
        return False, False # these are the loader
    problems = False
    asks_for_chrome = set() # Cc,Ci in: var {Cc,Ci} = require("chrome")
    asks_for_all_chrome = False # e.g.: var c = require("chrome")
    uses_chrome = set()
    uses_components = False
    uses_chrome_at = []
    for lineno,line in enumerate(lines):
        # note: this scanner is not obligated to spot all possible forms of
        # chrome access. The scanner is detecting voluntary requests for
        # chrome. Runtime tools will enforce allowance or denial of access.
        line = line.strip()
        iscomment = False
        for commentprefix in COMMENT_PREFIXES:
            if line.startswith(commentprefix):
                iscomment = True
        if iscomment:
            continue
        mo = re.search(REQUIRE_RE, line)
        if mo:
            if mo.group(1) == "chrome":
                for alias in CHROME_ALIASES:
                    if alias in line:
                        asks_for_chrome.add(alias)
                if not asks_for_chrome:
                    asks_for_all_chrome = True
        alias_in_this_line = False
        for wanted in CHROME_ALIASES:
            if re.search(r'\b'+wanted+r'\b', line):
                alias_in_this_line = True
                uses_chrome.add(wanted)
                uses_chrome_at.append( (wanted, lineno+1, line) )
        
        if not alias_in_this_line and "Components." in line:
            uses_components = True
            uses_chrome_at.append( (None, lineno+1, line) )
            problems = True
            break
    if uses_components or (uses_chrome - asks_for_chrome):
        problems = True
        print >>stderr, ""
        print >>stderr, "To use chrome authority, as in:"
        print >>stderr, " %s" % fn
        for (alias, lineno, line) in uses_chrome_at:
            if alias not in asks_for_chrome:
                print >>stderr, " %d> %s" % (lineno, line)
        print >>stderr, "You must enable it with something like:"
        uses = sorted(uses_chrome)
        if uses_components:
            uses.append("components")
        needed = ",".join(uses)
        print >>stderr, '  const {%s} = require("chrome");' % needed
    wants_chrome = bool(asks_for_chrome) or asks_for_all_chrome
    return wants_chrome, problems

def scan_module(fn, lines, stderr=sys.stderr):
    # barfs on /\s+/ in context-menu.js
    #requires = scan_requirements_with_jsscan(fn)
    requires = scan_requirements_with_grep(fn, lines)
    requires.pop("chrome", None)
    chrome, problems = scan_chrome(fn, lines, stderr)
    if chrome:
        requires["chrome"] = {}
    return requires, problems



if __name__ == '__main__':
    for fn in sys.argv[1:]:
        requires,problems = scan_module(fn, open(fn).readlines())
        print
        print "---", fn
        if problems:
            print "PROBLEMS"
            sys.exit(1)
        print "requires: %s" % (",".join(requires))

