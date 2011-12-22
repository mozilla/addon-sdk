
import os, sys, re, hashlib
import simplejson as json
from cuddlefish.util import filter_filenames, filter_dirnames

def to_json(o):
    return json.dumps(o, indent=1).encode("utf-8")+"\n"

class ModuleNotFoundError(Exception):
    def __init__(self, requirement_type, requirement_name,
                 used_by, line_number, looked_in):
        Exception.__init__(self)
        self.requirement_type = requirement_type # "require" or "define"
        self.requirement_name = requirement_name # string, what they require()d
        self.used_by = used_by # string, full path to module which did require()
        self.line_number = line_number # int, 1-indexed line number of first require()
        self.looked_in = looked_in # list of full paths to potential .js files
    def __str__(self):
        what = "%s(%s)" % (self.requirement_type, self.requirement_name)
        where = self.used_by
        if self.line_number is not None:
            where = "%s:%d" % (self.used_by, self.line_number)
        searched = "Looked for it in:\n  %s\n" % "\n  ".join(self.looked_in)
        return ("ModuleNotFoundError: unable to satisfy: %s from\n"
                "  %s:\n" % (what, where)) + searched

class BadModuleIdentifier(Exception):
    pass
class BadSection(Exception):
    pass
class UnreachablePrefixError(Exception):
    pass

def hash_file(fn):
    h = hashlib.sha256()
    f = open(fn,"rb")
    while True:
        data = f.read(64*1024)
        if not data:
            break
        h.update(data)
    f.close()
    return h.hexdigest()

class ManifestEntry:
    docs_filename = None
    docs_hash = None
    datamap = None

    def __init__(self, packageName, sectionName, moduleName):
        # the module graph may have cycles, so it's not trivial to include
        # js_filename and docs_filename as constructor arguments
        self.packageName = packageName
        self.sectionName = sectionName
        self.moduleName = moduleName
        if self.moduleName.endswith(".js"):
            self.moduleName = self.moduleName[:-3]
        self.moduleNameJS = self.moduleName+".js"
        self.path = "%s/%s/%s" % (packageName, sectionName, self.moduleNameJS)
        self.requirements = {}

    def add_js(self, js_filename):
        self.js_filename = js_filename
        self.js_hash = hash_file(js_filename)
    def add_docs(self, docs_filename):
        self.docs_filename = docs_filename
        self.docs_hash = hash_file(docs_filename)
    def add_requirement(self, reqname, reqdata):
        self.requirements[reqname] = reqdata # sometimes a ManifestEntry
    def add_data(self, datamap):
        self.datamap = datamap

    def get_entry_for_manifest(self):
        entry = { "packageName": self.packageName,
                  "sectionName": self.sectionName,
                  "moduleName": self.moduleName,
                  "jsSHA256": self.js_hash,
                  "requirements": {},
                  }
        if self.docs_hash:
            entry["docsSHA256"] = self.docs_hash
        for req in self.requirements:
            if isinstance(self.requirements[req], ManifestEntry):
                them = self.requirements[req] # this is another ManifestEntry
                them_path = them.get_path()
                entry["requirements"][req] = {"path": them_path}
            else:
                # something magic. The manifest entry indicates that they're
                # allowed to require() it
                entry["requirements"][req] = self.requirements[req]
            assert isinstance(entry["requirements"][req], dict)
        if self.datamap:
            entry["requirements"]["self"] = {
                "path": "self",
                "mapSHA256": self.datamap.get_manifest_hash(),
                "mapName": "%s/data.json" % self.packageName,
                "dataURIPrefix": "%s/data/" % self.packageName,
                }
        return entry


    def get_path(self):
        # this goes into the manifest. The loader knows to prepend
        # "resources/" before looking in the XPI.
        return self.path
    def get_js_zipname(self):
        return "resources/"+self.path
    def get_js_filename(self):
        return self.js_filename
    def get_relative_js_filepath(self):
        return [self.packageName, self.sectionName, self.moduleNameJS]

    def has_docs(self):
        return bool(self.docs_filename)
    def get_docs_zipname(self):
        return "resources/%s/docs/%s.md" % (self.packageName, self.moduleName)
    def get_docs_filename(self):
        return self.docs_filename
    def get_relative_docs_filepath(self):
        return [self.packageName, "docs", self.moduleName+".md"]


def get_datafiles(datadir):
    # yields pathnames relative to DATADIR, ignoring some files
    for dirpath, dirnames, filenames in os.walk(datadir):
        filenames = list(filter_filenames(filenames))
        # this tells os.walk to prune the search
        dirnames[:] = filter_dirnames(dirnames)
        for filename in filenames:
            fullname = os.path.join(dirpath, filename)
            assert fullname.startswith(datadir+os.path.sep), "%s%s not in %s" % (datadir, os.path.sep, fullname)
            yield fullname[len(datadir+os.path.sep):]

class DataMap:
    # one per package
    def __init__(self, pkg):
        self.pkg = pkg
        self.name = pkg.name
        self.files_to_copy = []
        datamap = {}
        datadir = os.path.join(pkg.root_dir, "data")
        for dataname in get_datafiles(datadir):
            relpath = dataname.split(os.path.sep)
            zipname = "resources/%s/data/%s" % (self.name, "/".join(relpath))
            absname = os.path.join(datadir, dataname)
            datamap[dataname] = hash_file(absname)
            filedata = (zipname, absname, relpath)
            self.files_to_copy.append(filedata)
        self.data_manifest = to_json(datamap)

    def get_files_to_copy(self):
        return self.files_to_copy
    def get_manifest_zipname(self):
        return "resources/%s/data.json" % self.name
    def get_manifest(self):
        return self.data_manifest
    def get_manifest_hash(self):
        return hashlib.sha256(self.data_manifest).hexdigest()


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
    def __init__(self, target_cfg, pkg_cfg, deps, extra_modules,
                 stderr=sys.stderr):
        self.manifest = {} # maps (package,section,module) to ManifestEntry
        self.target_cfg = target_cfg # the entry point
        self.pkg_cfg = pkg_cfg # all known packages
        self.deps = deps # list of package names to search
        self.used_packagenames = set()
        self.stderr = stderr
        self.extra_modules = extra_modules
        self.modules = {} # maps ModuleInfo to URI in self.manifest
        self.datamaps = {} # maps package name to DataMap instance
        self.files = [] # maps manifest index to (absfn,absfn) js/docs pair
        self.test_modules = [] # for runtime

    def build(self, scan_tests):
        # process the top module, which recurses to process everything it
        # reaches
        if "main" in self.target_cfg:
            top_me = self.process_module(self.find_top(self.target_cfg))
            self.top_path = top_me.get_path()
        if scan_tests:
            self.scan_tests()
        # include files used by the loader
        for em in self.extra_modules:
            (pkgname, section, modname, js) = em
            mi = ModuleInfo(self.pkg_cfg.packages[pkgname], section, modname,
                            js, None)
            self.process_module(mi)
        self.build_compile_maps()

    def scan_tests(self):
        mi = self._find_module_in_package("test-harness", "lib", "run-tests", [])
        self.process_module(mi)
        # also scan all test files in all packages that we use. By making
        # a copy of self.used_packagenames first, we refrain from
        # processing tests in packages that our own tests depend upon. If
        # we're running tests for package A, and either modules in A or
        # tests in A depend upon modules from package B, we *don't* want
        # to run tests for package B.
        test_modules = []
        dirnames = self.target_cfg["tests"]
        if isinstance(dirnames, basestring):
            dirnames = [dirnames]
        dirnames = [os.path.join(self.target_cfg.root_dir, d)
                    for d in dirnames]
        for d in dirnames:
            for filename in os.listdir(d):
                if filename.startswith("test-") and filename.endswith(".js"):
                    testname = filename[:-3] # require(testname)
                    #re.search(r'^test-.*\.js$', filename):
                    tmi = ModuleInfo(self.target_cfg, "tests", testname,
                                     os.path.join(d, filename), None)
                    # scan the test's dependencies
                    tme = self.process_module(tmi)
                    test_modules.append( (testname, tme) )
        # also add it as an artificial dependency of unit-test-finder, so
        # the runtime dynamic load can work.
        test_finder = self.get_manifest_entry("api-utils", "lib",
                                              "unit-test-finder")
        for (testname,tme) in test_modules:
            test_finder.add_requirement(testname, tme)
            # finally, tell the runtime about it, so they won't have to
            # search for all tests. self.test_modules will be passed
            # through the harness-options.json file in the
            # .allTestModules property.
            self.test_modules.append(testname)

    def get_module_entries(self):
        return frozenset(self.manifest.values())
    def get_data_entries(self):
        return frozenset(self.datamaps.values())

    def get_used_packages(self):
        used = set()
        for index in self.manifest:
            (package, section, module) = index
            used.add(package)
        return sorted(used)

    def get_all_test_modules(self):
        return self.test_modules

    def get_harness_options_manifest(self):
        manifest = {}
        for me in self.get_module_entries():
            path = me.get_path()
            manifest[path] = me.get_entry_for_manifest()
        return manifest

    def build_compile_maps(self):
        # create self.compile_map, self.pseudofiles, and self.decompile_data
        self.compile_map = compile_map = {}
        self.pseudofile_map = pseudofile_map = {} # maps zipname to bytestring
        self.decompile_data = {}
        self.decompile_data["main"] = self.target_cfg.name
        self.decompile_data["filemap"] = decompile_map = {}

        # JS and docs go into the zipfile
        include_docs = False # need to consider this
        for index, me in self.manifest.items():
            js_zipname = me.get_js_zipname()
            compile_map[js_zipname] = me.get_js_filename()
            decompile_map[js_zipname] = me.get_relative_js_filepath()
            docs_zipname = me.get_docs_zipname()
            if include_docs and docs_zipname:
                compile_map[docs_zipname] = me.get_docs_filename()
                decompile_map[docs_zipname] = me.get_relative_docs_filepath()

        # and all bundled data/ files
        for pkgname, dm in self.datamaps.items():
            for (zipname, absname, relpath) in dm.get_files_to_copy():
                compile_map[zipname] = absname
                decompile_map[zipname] = [pkgname, "data"] + relpath
            pseudofile_map[dm.get_manifest_zipname()] = dm.get_manifest()

        # include package.json too
        for pkgname in self.used_packagenames:
            pkg = self.pkg_cfg.packages[pkgname]
            target = "resources/%s/package.json" % pkgname
            pseudofile_map[target] = pkg.fullContents
            decompile_map[target] = [pkgname, "package.json"]

    def get_compile_map(self):
        # return a dict that maps each XPI-relative pathname to a local disk
        # filename. XPI pathnames are always joined with "/", regardless of
        # the local os.sep value. Local disk filenames are absolute. If you
        # copy all these files into the XPI, and add the files from the
        # template_root_dir, and install.rdf, and icon/icon64.png, and
        # harness-options.json, then you'll have a complete addon. You
        # probably want to store the corresponding decompile map too, so you
        # can reverse the process later.
        return self.compile_map

    def get_pseudofile_map(self):
        # return a dict mapping XPI-relative pathname to bytestrings, which
        # should be written into the XPI. This is used for generated files.
        return self.pseudofile_map

    def get_decompile_data(self):
        # Return a dict which explains how to unpack the XPI into a source
        # tree. The "main" element names the main (entry-point) package. The
        # "filemap" element is a dict that maps XPI-relative name to a
        # pathlist (list of pathname components, ready for
        # os.sep.join(pathlist) ). If you make local copies of all these
        # files (creating directories as necessary), and put them all on
        # --package-path, and run 'cfx xpi' from inside data["main"], then
        # you should be able to reconstruct the XPI.
        #
        # The filemap looks a lot like the return value of get_compile_map(),
        # but the filename keys will be shorter (and are lists). The compile
        # map's keys are absolute paths to various source directories, the
        # decompile map's keys are all relative pathlists to the same
        # anonymous output directory.
        return self.decompile_data

    def get_manifest_entry(self, package, section, module):
        index = (package, section, module)
        if index not in self.manifest:
            self.manifest[index] = ManifestEntry(package, section, module)
            self.used_packagenames.add(package)
        return self.manifest[index]

    def uri_name_from_path(self, pkg, fn):
        # given a filename like .../pkg1/lib/bar/foo.js, and a package
        # specification (with a .root_dir like ".../pkg1" and a .lib list of
        # paths where .lib[0] is like "lib"), return the appropriate NAME
        # that can be put into a URI like resource://JID-pkg1-lib/NAME . This
        # will throw an exception if the file is outside of the lib/
        # directory, since that means we can't construct a URI that points to
        # it.
        #
        # This should be a lot easier, and shouldn't fail when the file is in
        # the root of the package. Both should become possible when the XPI
        # is rearranged and our URI scheme is simplified.
        fn = os.path.abspath(fn)
        pkglib = pkg.lib[0]
        libdir = os.path.abspath(os.path.join(pkg.root_dir, pkglib))
        # AARGH, section and name! we need to reverse-engineer a
        # ModuleInfo instance that will produce a URI (in the form
        # PREFIX/PKGNAME-SECTION/JS) that will map to the existing file.
        # Until we fix URI generation to get rid of "sections", this is
        # limited to files in the same .directories.lib as the rest of
        # the package uses. So if the package's main files are in lib/,
        # but the main.js is in the package root, there is no URI we can
        # construct that will point to it, and we must fail.
        #
        # This will become much easier (and the failure case removed)
        # when we get rid of sections and change the URIs to look like
        # (PREFIX/PKGNAME/PATH-TO-JS).

        # AARGH 2, allowing .lib to be a list is really getting in the
        # way. That needs to go away eventually too.
        if not fn.startswith(libdir):
            raise UnreachablePrefixError("Sorry, but the 'main' file (%s) in package %s is outside that package's 'lib' directory (%s), so I cannot construct a URI to reach it."
                                         % (fn, pkg.name, pkglib))
        name = fn[len(libdir):].lstrip(os.path.sep)[:-len(".js")]
        return name


    def parse_main(self, root_dir, main, check_lib_dir=None):
        # 'main' can be like one of the following:
        #   a: ./lib/main.js  b: ./lib/main  c: lib/main
        # we require it to be a path to the file, though, and ignore the
        # .directories stuff. So just "main" is insufficient if you really
        # want something in a "lib/" subdirectory.
        if main.endswith(".js"):
            main = main[:-len(".js")]
        if main.startswith("./"):
            main = main[len("./"):]
        # package.json must always use "/", but on windows we'll replace that
        # with "\" before using it as an actual filename
        main = os.sep.join(main.split("/"))
        paths = [os.path.join(root_dir, main+".js")]
        if check_lib_dir is not None:
            paths.append(os.path.join(root_dir, check_lib_dir, main+".js"))
        return paths

    def find_top_js(self, target_cfg):
        for libdir in target_cfg.lib:
            for n in self.parse_main(target_cfg.root_dir, target_cfg.main,
                                     libdir):
                if os.path.exists(n):
                    return n
        raise KeyError("unable to find main module '%s.js' in top-level package" % target_cfg.main)

    def find_top(self, target_cfg):
        top_js = self.find_top_js(target_cfg)
        n = os.path.join(target_cfg.root_dir, "README.md")
        if os.path.exists(n):
            top_docs = n
        else:
            top_docs = None
        name = self.uri_name_from_path(target_cfg, top_js)
        return ModuleInfo(target_cfg, "lib", name, top_js, top_docs)

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
        requires, problems, locations = scan_module(mi.js,js_lines,self.stderr)
        if problems:
            # the relevant instructions have already been written to stderr
            raise BadChromeMarkerError()

        # We update our requirements on the way out of the depth-first
        # traversal of the module graph

        for reqname in sorted(requires.keys()):
            if reqname in ("chrome", "@packaging", "@loader"):
                me.add_requirement(reqname, {"path": reqname})
            elif reqname == "self":
                # this might reference bundled data, so:
                #  1: hash that data, add the hash as a dependency
                #  2: arrange for the data to be copied into the XPI later
                dm = self.add_datamap(pkg.name, pkg)
                me.add_data(dm) # 'self' is implicit
            else:
                # when two modules require() the same name, do they get a
                # shared instance? This is a deep question. For now say yes.

                # find_req_for() returns an entry to put in our
                # 'requirements' dict, and will recursively process
                # everything transitively required from here. It will also
                # populate the self.modules[] cache. Note that we must
                # tolerate cycles in the reference graph.
                looked_in = [] # populated by subroutines
                them_me = self.find_req_for(mi, reqname, looked_in)
                if them_me is None:
                    if mi.section == "tests":
                        # tolerate missing modules in tests, because
                        # test-securable-module.js, and the modules/red.js
                        # that it imports, both do that intentionally
                        continue
                    lineno = locations.get(reqname) # None means define()
                    if lineno is None:
                        reqtype = "define"
                    else:
                        reqtype = "require"
                    err = ModuleNotFoundError(reqtype, reqname,
                                              mi.js, lineno, looked_in)
                    raise err
                else:
                    me.add_requirement(reqname, them_me)

        return me
        #print "LEAVING", pkg.name, mi.name

    def add_datamap(self, name, pkg):
        if name not in self.datamaps:
            self.datamaps[name] = DataMap(pkg)
        return self.datamaps[name]

    def find_req_for(self, from_module, reqname, looked_in):
        # handle a single require(reqname) statement from from_module .
        # Return a uri that exists in self.manifest
        # Populate looked_in with places we looked.
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
            lookfor_pkg = from_module.package.name
            lookfor_mod = "/".join(bits)
            return self._get_module_from_package(lookfor_pkg,
                                                 lookfor_sections, lookfor_mod,
                                                 looked_in)

        # non-relative import. Might be a short name (requiring a search
        # through "library" packages), or a fully-qualified one.

        if "/" in reqname:
            # 2: PKG/MOD: find PKG, look inside for MOD
            lookfor_pkg = bits[0]
            lookfor_mod = "/".join(bits[1:])
            mi = self._get_module_from_package(lookfor_pkg,
                                               lookfor_sections, lookfor_mod,
                                               looked_in)
            if mi: # caution, 0==None
                return mi
        else:
            # 3: try finding PKG, if found, use its main.js entry point
            lookfor_pkg = reqname
            mi = self._get_entrypoint_from_package(lookfor_pkg, looked_in)
            if mi:
                return mi

        # 4: search packages for MOD or MODPARENT/MODCHILD. We always search
        # their own package first, then the list of packages defined by their
        # .dependencies list
        from_pkg = from_module.package.name
        return self._search_packages_for_module(from_pkg,
                                                lookfor_sections, reqname,
                                                looked_in)

    def _handle_module(self, mi):
        if not mi:
            return None

        # we tolerate cycles in the reference graph, which means we need to
        # populate the self.modules cache before recursing into
        # process_module() . We must also check the cache first, so recursion
        # can terminate.
        if mi in self.modules:
            return self.modules[mi]

        # this creates the entry
        new_entry = self.get_manifest_entry(mi.package.name, mi.section, mi.name)
        # and populates the cache
        self.modules[mi] = new_entry
        self.process_module(mi)
        return new_entry

    def _get_module_from_package(self, pkgname, sections, modname, looked_in):
        if pkgname not in self.pkg_cfg.packages:
            return None
        mi = self._find_module_in_package(pkgname, sections, modname,
                                          looked_in)
        return self._handle_module(mi)

    def _get_entrypoint_from_package(self, pkgname, looked_in):
        if pkgname not in self.pkg_cfg.packages:
            return None
        pkg = self.pkg_cfg.packages[pkgname]
        main = pkg.get("main", None)
        if not main:
            return None
        for js in self.parse_main(pkg.root_dir, main):
            looked_in.append(js)
            if os.path.exists(js):
                section = "lib"
                name = self.uri_name_from_path(pkg, js)
                docs = None
                mi = ModuleInfo(pkg, section, name, js, docs)
                return self._handle_module(mi)
        return None

    def _search_packages_for_module(self, from_pkg, sections, reqname,
                                    looked_in):
        searchpath = [] # list of package names
        searchpath.append(from_pkg) # search self first
        us = self.pkg_cfg.packages[from_pkg]
        if 'dependencies' in us:
            # only look in dependencies
            searchpath.extend(us['dependencies'])
        else:
            # they didn't declare any dependencies (or they declared an empty
            # list, but we'll treat that as not declaring one, because it's
            # easier), so look in all deps, sorted alphabetically, so
            # addon-kit comes first. Note that self.deps includes all
            # packages found by traversing the ".dependencies" lists in each
            # package.json, starting from the main addon package, plus
            # everything added by --extra-packages
            searchpath.extend(sorted(self.deps))
        for pkgname in searchpath:
            mi = self._find_module_in_package(pkgname, sections, reqname,
                                              looked_in)
            if mi:
                return self._handle_module(mi)
        return None

    def _find_module_in_package(self, pkgname, sections, name, looked_in):
        # require("a/b/c") should look at ...\a\b\c.js on windows
        filename = os.sep.join(name.split("/"))
        # normalize filename, make sure that we do not add .js if it already has
        # it.
        if not filename.endswith(".js"):
          filename += ".js"
        basename = filename[:-3]

        pkg = self.pkg_cfg.packages[pkgname]
        if isinstance(sections, basestring):
            sections = [sections]
        for section in sections:
            for sdir in pkg.get(section, []):
                js = os.path.join(pkg.root_dir, sdir, filename)
                looked_in.append(js)
                if os.path.exists(js):
                    docs = None
                    maybe_docs = os.path.join(pkg.root_dir, "docs",
                                              basename+".md")
                    if section == "lib" and os.path.exists(maybe_docs):
                        docs = maybe_docs
                    return ModuleInfo(pkg, section, name, js, docs)
        return None

def build_manifest(target_cfg, pkg_cfg, deps, scan_tests,
                   extra_modules=[]):
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

    mxt = ManifestBuilder(target_cfg, pkg_cfg, deps, extra_modules)
    mxt.build(scan_tests)
    return mxt



COMMENT_PREFIXES = ["//", "/*", "*", "dump("]

REQUIRE_RE = r"(?<![\'\"])require\s*\(\s*[\'\"]([^\'\"]+?)[\'\"]\s*\)"

# detect the define idiom of the form:
#   define("module name", ["dep1", "dep2", "dep3"], function() {})
# by capturing the contents of the list in a group.
DEF_RE = re.compile(r"(require|define)\s*\(\s*([\'\"][^\'\"]+[\'\"]\s*,)?\s*\[([^\]]+)\]")

# Out of the async dependencies, do not allow quotes in them.
DEF_RE_ALLOWED = re.compile(r"^[\'\"][^\'\"]+[\'\"]$")

def scan_requirements_with_grep(fn, lines):
    requires = {}
    first_location = {}
    for (lineno0, line) in enumerate(lines):
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
                if modname not in first_location:
                    first_location[modname] = lineno0+1

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
                    # joining all the lines means we lose line numbers, so we
                    # can't fill first_location[]

    return requires, first_location

CHROME_ALIASES = [
    (re.compile(r"Components\.classes"), "Cc"),
    (re.compile(r"Components\.interfaces"), "Ci"),
    (re.compile(r"Components\.utils"), "Cu"),
    (re.compile(r"Components\.results"), "Cr"),
    (re.compile(r"Components\.manager"), "Cm"),
    ]
OTHER_CHROME = re.compile(r"Components\.[a-zA-Z]")

def scan_for_bad_chrome(fn, lines, stderr):
    problems = False
    old_chrome = set() # i.e. "Cc" when we see "Components.classes"
    old_chrome_lines = [] # list of (lineno, line.strip()) tuples
    for lineno,line in enumerate(lines):
        # note: this scanner is not obligated to spot all possible forms of
        # chrome access. The scanner is detecting voluntary requests for
        # chrome. Runtime tools will enforce allowance or denial of access.
        line = line.strip()
        iscomment = False
        for commentprefix in COMMENT_PREFIXES:
            if line.startswith(commentprefix):
                iscomment = True
                break
        if iscomment:
            continue
        old_chrome_in_this_line = set()
        for (regexp,alias) in CHROME_ALIASES:
            if regexp.search(line):
                old_chrome_in_this_line.add(alias)
        if not old_chrome_in_this_line:
            if OTHER_CHROME.search(line):
                old_chrome_in_this_line.add("components")
        old_chrome.update(old_chrome_in_this_line)
        if old_chrome_in_this_line:
            old_chrome_lines.append( (lineno+1, line) )

    if old_chrome:
        print >>stderr, """
The following lines from file %(fn)s:
%(lines)s
use 'Components' to access chrome authority. To do so, you need to add a
line somewhat like the following:

  const {%(needs)s} = require("chrome");

Then you can use 'Components' as well as any shortcuts to its properties
that you import from the 'chrome' module ('Cc', 'Ci', 'Cm', 'Cr', and
'Cu' for the 'classes', 'interfaces', 'manager', 'results', and 'utils'
properties, respectively).

(Note: once bug 636145 is fixed, to access 'Components' directly you'll
need to retrieve it from the 'chrome' module by adding it to the list of
symbols you import from the module. To avoid having to make this change
in the future, replace all occurrences of 'Components' in your code with
the equivalent shortcuts now.)
""" % { "fn": fn, "needs": ",".join(sorted(old_chrome)),
        "lines": "\n".join([" %3d: %s" % (lineno,line)
                            for (lineno, line) in old_chrome_lines]),
        }
        problems = True
    return problems

def scan_module(fn, lines, stderr=sys.stderr):
    filename = os.path.basename(fn)
    requires, locations = scan_requirements_with_grep(fn, lines)
    if filename == "cuddlefish.js":
        # this is the loader: don't scan for chrome
        problems = False
    elif "chrome" in requires:
        # if they declare require("chrome"), we tolerate the use of
        # Components (see bug 663541 for rationale)
        problems = False
    else:
        problems = scan_for_bad_chrome(fn, lines, stderr)
    return requires, problems, locations



if __name__ == '__main__':
    for fn in sys.argv[1:]:
        requires, problems, locations = scan_module(fn, open(fn).readlines())
        print
        print "---", fn
        if problems:
            print "PROBLEMS"
            sys.exit(1)
        print "requires: %s" % (",".join(sorted(requires.keys())))
        print "locations: %s" % locations

