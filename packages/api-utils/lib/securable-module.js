/* ***** BEGIN LICENSE BLOCK *****
 * Copyright (c) 2009-2010 the Mozilla Foundation
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 *  * Redistributions of source code must retain the above copyright notice,
 *    this list of conditions and the following disclaimer.
 *  * Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *  * Neither the name of the Mozilla Foundation nor the names
 *    of its contributors may be used to endorse or promote products derived
 *    from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * ***** END LICENSE BLOCK ***** */

(function(global) {
   const Cc = Components.classes;
   const Ci = Components.interfaces;
   const Cu = Components.utils;
   const Cr = Components.results;

   var exports = {};

   var ios = Cc['@mozilla.org/network/io-service;1']
             .getService(Ci.nsIIOService);

   var systemPrincipal = Cc["@mozilla.org/systemprincipal;1"]
                         .createInstance(Ci.nsIPrincipal);

   // Even though manifest.py does some dependency scanning, that
   // scan is done as part of an evaluation of what the add-on needs
   // for security purposes. The following regexps are used to scan for
   // dependencies inside a simplified define() callback:
   // define(function(require, exports, module){ var a = require('a'); });
   // and are used at runtime ensure the dependencies needed by
   // the define factory function are already evaluated and ready.
   // Even though this loader is a sync loader, and could fetch the module
   // as the require() call happens, it would differ in behavior as
   // compared to the async browser case, which would make sure to execute
   // the dependencies first before executing the define() factory function.
   // So this dependency scanning and evaluation is kept to match the
   // async behavior.
   var commentRegExp = /(\/\*([\s\S]*?)\*\/|\/\/(.*)$)/mg;
   var cjsRequireRegExp = /require\(["']([\w\!\-_\.\/]+)["']\)/g;
   var cjsStandardDeps = ['require', 'exports', 'module'];

   function resolvePrincipal(principal, defaultPrincipal) {
     if (principal === undefined)
       return defaultPrincipal;
     if (principal == "system")
       return systemPrincipal;
     return principal;
   }

   // The base URI to we use when we're given relative URLs, if any.
   var baseURI = null;
   if (global.window)
     baseURI = ios.newURI(global.location.href, null, null);
   exports.baseURI = baseURI;

   // The "parent" chrome URI to use if we're loading code that
   // needs chrome privileges but may not have a filename that
   // matches any of SpiderMonkey's defined system filename prefixes.
   // The latter is needed so that wrappers can be automatically
   // made for the code. For more information on this, see
   // bug 418356:
   //
   // https://bugzilla.mozilla.org/show_bug.cgi?id=418356
   var parentChromeURIString;
   if (baseURI)
     // We're being loaded from a chrome-privileged document, so
     // use its URL as the parent string.
     parentChromeURIString = baseURI.spec;
   else
     // We're being loaded from a chrome-privileged JS module or
     // SecurableModule, so use its filename (which may itself
     // contain a reference to a parent).
     parentChromeURIString = Components.stack.filename;

   function maybeParentifyFilename(filename) {
     var doParentifyFilename = true;
     try {
       // TODO: Ideally we should just make
       // nsIChromeRegistry.wrappersEnabled() available from script
       // and use it here. Until that's in the platform, though,
       // we'll play it safe and parentify the filename unless
       // we're absolutely certain things will be ok if we don't.
       var filenameURI = ios.newURI(options.filename,
                                    null,
                                    baseURI);
       if (filenameURI.scheme == 'chrome' &&
           filenameURI.path.indexOf('/content/') == 0)
         // Content packages will always have wrappers made for them;
         // if automatic wrappers have been disabled for the
         // chrome package via a chrome manifest flag, then
         // this still works too, to the extent that the
         // content package is insecure anyways.
         doParentifyFilename = false;
     } catch (e) {}
     if (doParentifyFilename)
       return parentChromeURIString + " -> " + filename;
     return filename;
   }

   function getRootDir(urlStr) {
     // TODO: This feels hacky, and like there will be edge cases.
     return urlStr.slice(0, urlStr.lastIndexOf("/") + 1);
   }

   exports.SandboxFactory = function SandboxFactory(defaultPrincipal) {
     // Unless specified otherwise, use a principal with limited
     // privileges.
     this._defaultPrincipal = resolvePrincipal(defaultPrincipal,
                                               "http://www.mozilla.org");
   },

   exports.SandboxFactory.prototype = {
     createSandbox: function createSandbox(options) {
       var principal = resolvePrincipal(options.principal,
                                        this._defaultPrincipal);

       return {
         _sandbox: new Cu.Sandbox(principal),
         _principal: principal,
         get globalScope() {
           return this._sandbox;
         },
         defineProperty: function defineProperty(name, value) {
           this._sandbox[name] = value;
         },
         getProperty: function getProperty(name) {
           return this._sandbox[name];
         },
         evaluate: function evaluate(options) {
           if (typeof(options) == 'string')
             options = {contents: options};
           options = {__proto__: options};
           if (typeof(options.contents) != 'string')
             throw new Error('Expected string for options.contents');
           if (options.lineNo === undefined)
             options.lineNo = 1;
           if (options.jsVersion === undefined)
             options.jsVersion = "1.8";
           if (typeof(options.filename) != 'string')
             options.filename = '<string>';

           if (this._principal == systemPrincipal)
             options.filename = maybeParentifyFilename(options.filename);

           return Cu.evalInSandbox(options.contents,
                                   this._sandbox,
                                   options.jsVersion,
                                   options.filename,
                                   options.lineNo);
         }
       };
     }
   };

   exports.Loader = function Loader(options) {
     options = {__proto__: options};
     if (options.fs === undefined) {
       var rootPaths = options.rootPath || options.rootPaths;
       if (rootPaths) {
         if (rootPaths.constructor.name != "Array")
           rootPaths = [rootPaths];
         var fses = [new exports.LocalFileSystem(path)
                     for each (path in rootPaths)];
         options.fs = new exports.CompositeFileSystem({
           fses: fses,
           metadata: options.metadata,
           uriPrefix: options.uriPrefix,
           name: options.name
         });
       } else
         options.fs = new exports.LocalFileSystem();
     }
     if (options.sandboxFactory === undefined)
       options.sandboxFactory = new exports.SandboxFactory(
         options.defaultPrincipal
       );
     if ('modules' in options)
       throw new Error('options.modules is no longer supported');
     // pathAccessed used to know if a module was accessed/required
     // by another module, and in that case, assigning the module value
     // via a define callback is not allowed.
     if (options.pathAccessed === undefined)
       options.pathAccessed = {};
     if (options.globals === undefined)
       options.globals = {};

     this.fs = options.fs;
     this.sandboxFactory = options.sandboxFactory;
     this.sandboxes = {};
     this.modules = {};
     this.pathAccessed = options.pathAccessed;
     this.defineUsed = {};
     this.globals = options.globals;
     this.getModuleExports = options.getModuleExports;
     this.modifyModuleSandbox = options.modifyModuleSandbox;
     this.manifest = options.manifest || {};
   };

   exports.Loader.prototype = {
     _makeApi: function _makeApi(basePath) {
       /*
        * _makeApi() creates a pair of specialized require()/define()
        * functions for use by the code that comes from 'basePath' (which is
        * a resource: URI pointing to some module, e.g. main.js). This
        * require/define pair knows what main.js is allowed to import, in
        * particular it knows what the link-time module search algorithm has
        * found for each imported name (so if they require "panel", they'll
        * get the one from addon-kit, not from some other package).
        *
        * When some other module (e.g. panel.js) is loaded, they'll get a
        * different require/define pair, specialized for them.
        */
       var self = this;
       let reqs;
       if (basePath && (basePath in self.manifest))
         reqs = self.manifest[basePath].requirements;

       function syncRequire(module) {
         if (reqs) {
           // if we know about you, you must follow the manifest
           if (module in reqs)
             return loadMaybeMagicModule(module, reqs[module]);
           // if you invoke chrome, you can go off-manifest and search
           if ("chrome" in reqs)
             return loadMaybeMagicModule(module, null);
           throw new Error("Module at "+basePath+" not allowed to require"+"("+module+")");
         } else {
           // if we don't know about you, you can do anything you want.
           // You're going to have to search for your own modules, though.
           return loadMaybeMagicModule(module, null);
         }
       }

       function loadMaybeMagicModule(moduleName, moduleData) {
         /*
          * If we get here, we're allowed to import this module, we just have
          * to figure out how.
          *
          * 'moduleName' is the unmodified argument passed to require(),
          * so it might be "panel" or "pkg/foo" or even "./bar" for relative
          * imports. 'moduleData' is the manifest entry that tells us how
          * we're supposed to import this module: usually it's an object with
          * a .uri, but for certain "magic" modules it might be empty. If
          * it's 'null' then we're supposed to search all known packages for
          * it.
          */

         if (self.getModuleExports) {
           /* this currently handles 'chrome' and 'parent-loader' */
           let exports = self.getModuleExports(basePath, moduleName);
           if (exports)
             return exports;
         }
         if (moduleName == "self") {
           /* The 'self' module is magic: when someone requires 'self', the
            * module they get is supposed to be specialized for the *package*
            * that they live in (so pkg1/foo.js will get 'self' for pkg1,
            * while pkg2/bar.js will get a 'self' for pkg2). To accomplish
            * this, we don't give them the real self.js module directly:
            * instead, we load self.js and invoke its makeSelfModule()
            * function, passing in the manifest's moduleData, which will
            * include enough information to create the specialized module.
            */
           if (!moduleData) {
             // we don't know where you live, so we must search for your data
             // resource://api-utils-api-utils-tests/test-self.js
             // make a prefix of resource://api-utils-api-utils-data/
             let doubleslash = basePath.indexOf("//");
             let prefix = basePath.slice(0, doubleslash+2);
             let rest = basePath.slice(doubleslash+2);
             let slash = rest.indexOf("/");
             prefix = prefix + rest.slice(0, slash);
             prefix = prefix.slice(0, prefix.lastIndexOf("-")) + "-data/";
             moduleData = { "dataURIPrefix": prefix };
             // moduleData also wants mapName and mapSHA256, but they're
             // currently unused
           }
           if (false) // force scanner to copy self-maker.js into the XPI
             require("self-maker"); 
           let makerModData = {uri: self.fs.resolveModule(null, "self-maker")};
           if (!makerModData.uri)
             throw new Error("Unable to find self-maker, from "+basePath);
           let selfMod = loadFromModuleData(makerModData, "self-maker");
           // selfMod is not cached
           return selfMod.makeSelfModule(moduleData);
         }

         if (!moduleData) {
           // search
           let path = self.fs.resolveModule(basePath, moduleName);
           if (!path)
             throw new Error('Module "' + moduleName + '" not found');
           moduleData = {uri: path};
         }

         // Track accesses to this module via its normalized path. This lets
         // us detect cases where foo.js uses define() with a callback that
         // wants to return a new value for the 'foo' module, but something
         // inside that callback (probably in some sub-function) references
         // 'foo' too early. If this happens, we throw an exception when the
         // callback finishes. The code for that is in define() below: search
         // for self.pathAccessed .
         if (!self.pathAccessed[moduleData.uri]) {
           self.pathAccessed[moduleData.uri] = 0;
         }
         self.pathAccessed[moduleData.uri] += 1;

         if (moduleData.uri in self.modules) {
           // already loaded: return from cache
           return self.modules[moduleData.uri];
         }
         return loadFromModuleData(moduleData, moduleName); // adds to cache
       }

       function loadFromModuleData(moduleData, moduleName) {
         // moduleName is passed solely for error messages: by this point,
         // everything is controlled by moduleData
         if (!moduleData.uri) {
           throw new Error("loadFromModuleData with null URI, from basePath "
                           +basePath+" importing ("+moduleName+")");
         }
         // any manifest-based permission checks have already been done
         let path = moduleData.uri;

         let moduleContents = self.fs.getFile(path);
         var sandbox = self.sandboxFactory.createSandbox(moduleContents);
         self.sandboxes[path] = sandbox;
         for (name in self.globals)
           sandbox.defineProperty(name, self.globals[name]);
         var api = self._makeApi(path);
         sandbox.defineProperty('require', api.require);
         sandbox.defineProperty('define', api.define);
         if (self.modifyModuleSandbox)
           self.modifyModuleSandbox(sandbox, moduleContents);
         /* set up an environment in which module code can use CommonJS
            patterns like:
              module.exports = newobj;
              module.setExports(newobj);
              if (module.id == "main") stuff();
              define("async", function() {return newobj});
          */
         sandbox.evaluate("var module = {exports: {}};");
         sandbox.evaluate("module.setExports = function(obj) {module.exports = obj; return obj;};");
         sandbox.evaluate("var exports = module.exports;");
         sandbox.evaluate("module.id = '" + path + "';");
         var preeval_exports = sandbox.getProperty("exports");
         self.modules[path] = sandbox.getProperty("exports");
         sandbox.evaluate(moduleContents);
         var posteval_exports = sandbox.getProperty("module").exports;
         if (posteval_exports !== preeval_exports) {
           /* if they used module.exports= or module.setExports(), get
              the new value now. If they used define(), we must be
              careful to leave self.modules[path] alone, as it will have
              been modified in the asyncMain() callback-handling code,
              fired during sandbox.evaluate(). */
           if (self.defineUsed[path]) {
             // you can do one or the other, not both
             throw new Error("define() was used, so module.exports= and "
                             + "module.setExports() may not be used: "
                             + path);
           }
           self.modules[path] = posteval_exports;
         }
         return self.modules[path]; // these are the exports
       }

       // START support Async module-style require and define calls.
       // If the only argument to require is a string, then the module that
       // is represented by that string is fetched for the appropriate context.
       //
       // If the first argument is an array, then it will be treated as an array
       // of dependency string names to fetch. An optional function callback can
       // be specified to execute when all of those dependencies are available.
       function asyncRequire(deps, callback) {
         if (typeof deps === "string" && !callback) {
           // Just return the module wanted via sync require.
           return syncRequire(deps);
         } else {
           asyncMain(null, basePath, null, deps, callback);
           return undefined;
         }
       }

       // The function that handles definitions of modules. Differs from
       // require() in that a string for the module should be the first
       // argument, and the function to execute after dependencies are loaded
       // should return a value to define the module corresponding to the first
       // argument's name.
       function define (name, deps, callback) {

         // Only allow one call to define per module/file.
         if (self.defineUsed[basePath]) {
           throw new Error("Only one call to define() allowed per file: " +
                            basePath);
         } else {
           self.defineUsed[basePath] = true;
         }

         // For anonymous modules, the namePath is the basePath
         var namePath = basePath,
             exports = {}, exported;

         // Adjust args if an anonymous module
         if (typeof name !== 'string') {
           callback = deps;
           deps = name;
           name = null;
         }

         // If just a define({}) call (no dependencies),
         // adjust args accordingly.
         if (!Array.isArray(deps)) {
           callback = deps;
           deps = null;
         }

         // If the callback is not an actual function, it means it already
         // has the definition of the module as a literal value.
         if (!deps && callback && typeof callback !== 'function') {
           self.modules[namePath] = callback;
           return;
         }

         // Set the exports value now in case other modules need a handle
         // on it for cyclical cases.
         self.modules[namePath] = exports;

         // Load dependencies and call the module's definition function.
         exported = asyncMain(name, namePath, exports, deps, callback);

         // Assign output of function to name, if exports was not
         // in play (which asyncMain already figured out).
         if (exported !== undefined) {
           if (self.pathAccessed[namePath] > 1) {
             // Another module already accessed the exported value,
             // need to throw to avoid nasty circular dependency weirdness
             throw new Error('Module "' + (name || namePath) + '" cannot use ' +
                             'return from define to define the module ' +
                             'after another module has referenced its ' +
                             'exported value.');
           } else {
             self.modules[namePath] = exported;
           }
         }
       }

       // The function that handles the main async module work, for both
       // require([], function(){}) calls and define calls.
       // It makes sure all the dependencies exist before calling the
       // callback function. It will return the result of the callback
       // function if "exports" is not a dependency.
       function asyncMain (name, namePath, exports, deps, callback) {

         if (typeof deps === 'function') {
           callback = deps;
           deps = null;
         }

         if (!deps) {
           deps = [];
           // The shortened form of the async wrapper for CommonJS modules:
           // define(function (require, exports, module) {});
           // require calls could be inside the function, so toString it
           // and pull out the dependencies.

           // Remove comments from the callback string,
           // look for require calls, and pull them into the dependencies.
           // The comment regexp is not very robust, but good enough to
           // avoid commented out require calls and to find normal, sync
           // require calls in the function.
           callback
               .toString()
               .replace(commentRegExp, "")
               .replace(cjsRequireRegExp, function (match, dep) {
                 deps.push(dep);
               });
           // Prepend standard require, exports, and module dependencies
           // (and in that *exact* order per spec), but only add as many as
           // was asked for via the callback's function argument length.
           // In particular, do *not* pass exports if it was not asked for.
           // By asking for exports as a dependency the rest of this
           // asyncRequire code assumes then that the return value from the
           // function should not be used as the exported module value.
           deps = cjsStandardDeps.slice(0, callback.length).concat(deps);
         }

         var depModules = [],
             usesExports = false,
             exported;

         // Load all the dependencies, with the "require", "exports" and
         // "module" ones getting special handling to match the traditional
         // CommonJS sync module expectations.
         deps.forEach(function (dep) {
             if (dep === "require") {
               depModules.push(asyncRequire);
             } else if (dep === "module") {
               depModules.push({
                 id: name
               });
             } else if (dep === "exports") {
               usesExports = true;
               depModules.push(exports);
             } else {
               depModules.push(syncRequire(dep));
             }
         });

         // Execute the function.
         if (callback) {
           exported = callback.apply(null, depModules);
         }

         if (exported !== undefined) {
           if (usesExports) {
             throw new Error('Inside "' + namePath + '", cannot use exports ' +
                             'and also return a value from a define ' +
                             'definition function');
           } else {
             return exported;
           }
         }
         return undefined;
       };

       return {
         require: asyncRequire,
         define: define
       };
       // END support for Async module-style
     },

     // This is only really used by unit tests and other
     // development-related facilities, allowing access to symbols
     // defined in the global scope of a module.
     findSandboxForModule: function findSandboxForModule(module) {
       var path = this.fs.resolveModule(null, module);
       if (!path)
         throw new Error('Module "' + module + '" not found');
       if (!(path in this.sandboxes))
         this.require(module);
       if (!(path in this.sandboxes))
         throw new Error('Internal error: path not in sandboxes: ' +
                         path);
       return this.sandboxes[path];
     },

     require: function require(module, callback) {
       return (this._makeApi(null).require)(module, callback);
     },

     runScript: function runScript(options, extraOutput) {
       if (typeof(options) == 'string')
         options = {contents: options};
       options = {__proto__: options};
       var sandbox = this.sandboxFactory.createSandbox(options);
       if (extraOutput)
         extraOutput.sandbox = sandbox;
       for (name in this.globals)
         sandbox.defineProperty(name, this.globals[name]);
       var api = this._makeApi(null);
       sandbox.defineProperty('require', api.require);
       sandbox.defineProperty('define', api.define);
       return sandbox.evaluate(options);
     }
   };

   // this is more of a resolver than a filesystem, but test-securable-module
   // wants to override the getFile() function to avoid using real URIs
   exports.CompositeFileSystem = function CompositeFileSystem(options) {
     // We sort file systems in alphabetical order of a package name.
     this.fses = options.fses.sort(function(a, b) a.root > b.root);
     this.uriPrefix = options.uriPrefix;
     this.name = options.name;
     this.packages = options.metadata || {};
   };

   function isRelative(path) path.charAt(0) === "."
   function isNested(path) ~path.indexOf("/")
   function normalizePath(path) path.substr(-3) === ".js" ? path : path + ".js"
   function relatifyPath(path) isRelative(path) ? path : "./" + path
   function getPackageName(path) path.substr(0, path.indexOf("/"))
   function getInPackagePath(path) path.substr(path.indexOf("/") + 1)
   function isRelativeTo(path, base) 0 === path.indexOf(base)
   function resolveTo(path, base) "." + path.substr(base.length)

   exports.CompositeFileSystem.prototype = {
     getPackageURI: function getPackageURI(name) {
       let uri = this.uriPrefix + name + "-lib/";
       return ios.newURI(uri, null, null).spec;
     },
     resolveModule: function resolveModule(base, path) {
       // If it is relative path we don't need to search anything
       // as it should be module from the same package.
       if (isRelative(path)) {
         // If base is not provided then it's a main module with a relative
         // path to we use `packageURI` as a base to resolve.
         base = base || this.getPackageURI(this.name);
         return this.resolveRelative(base, path);
       }

       // If path contains only one part then we treat if it as
       // require(PCKG/{{(package.json).main}}
       if (!isNested(path))
         return this.resolveMain(path) || this.searchModule(path);

       // If path contains more then one part than we try to interpret that
       // as `require(PCKG/module)` first and fall back to search.
       return this.resolveModuleFromPackage(path) || this.searchModule(path);

     },
     resolveRelative: function resolveRelative(base, path) {
        path = normalizePath(path);
        let uri = ios.newURI(path, null, ios.newURI(base, null, null));

        try {
          let channel = ios.newChannelFromURI(uri);
          channel.open().close();
        } catch (e) {
          return null;
        }
        return uri.spec;
     },
     searchModule: function seachModule(path) {
       for each (let fs in this.fses) {
         let id = fs.resolveModule(null, path);
         if (id)
           return id;
       }
       return null;
     },
     resolveModuleFromPackage: function resolveModuleFromPackage(path) {
       let name = getPackageName(path);
       if (name in this.packages) {
         let base = this.getPackageURI(name);
         return this.resolveRelative(base, getInPackagePath(path));
       }
       return null;
     },
     resolveMain: function resolveMain(name) {
       if (name in this.packages) {
         let base = this.getPackageURI(name);
         let path = relatifyPath(this.packages[name].main || "main");

         // We need to make sure to strip out directory from the main if it
         // contains "lib" part. Unfortunately if main out of the lib folder
         // requiring main module will fail as it will be out of the mapped
         // resource URI.
         let dirs = this.packages[name].directories;
         let lib = relatifyPath(dirs ? dirs.lib || "./lib" : "./lib");
         if (isRelativeTo(path, lib))
           path = resolveTo(path, lib);

         return this.resolveRelative(base, path);
       }
       return null;
     },
     getFile: function getFile(path) {
       return loadFile(path);
     }
   };

   exports.LocalFileSystem = function LocalFileSystem(root) {
     if (root === undefined) {
       if (!baseURI)
         throw new Error("Need a root path for module filesystem");
       root = baseURI;
     }
     if (typeof(root) == 'string')
       root = ios.newURI(root, null, baseURI);
     if (root instanceof Ci.nsIFile)
       root = ios.newFileURI(root);
     if (!(root instanceof Ci.nsIURI))
       throw new Error('Expected nsIFile, nsIURI, or string for root');

     this.root = root.spec;
     this._rootURI = root;
     this._rootURIDir = getRootDir(root.spec);
   };

   exports.LocalFileSystem.prototype = {
     resolveModule: function resolveModule(base, path) {
       path = normalizePath(path);

       var baseURI;
       if (!base || path.charAt(0) != '.')
         baseURI = this._rootURI;
       else
         baseURI = ios.newURI(base, null, null);

       var newURI = ios.newURI(path, null, baseURI);
       if (newURI.spec.indexOf(this._rootURIDir) == 0) {
         var channel = ios.newChannelFromURI(newURI);
         try {
           channel.open().close();
         } catch (e if e.result == Cr.NS_ERROR_FILE_NOT_FOUND) {
           return null;
         }
         return newURI.spec;
       }
       return null;
     },
     getFile: function getFile(path) {
       return loadFile(path);
     }
   };

   function loadFile(path) {
     var channel = ios.newChannel(path, null, null);
     var iStream = channel.open();
     var ciStream = Cc["@mozilla.org/intl/converter-input-stream;1"].
       createInstance(Ci.nsIConverterInputStream);
     var bufLen = 0x8000;
     ciStream.init(iStream, "UTF-8", bufLen,
                   Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
     var chunk = {};
     var data = "";
     while (ciStream.readString(bufLen, chunk) > 0)
       data += chunk.value;
     ciStream.close();
     iStream.close();
     return {contents: data, filename: path};
   };

   if (global.window) {
     // We're being loaded in a chrome window, or a web page with
     // UniversalXPConnect privileges.
     global.SecurableModule = exports;
   } else if (global.exports) {
     // We're being loaded in a SecurableModule.
     for (name in exports) {
       global.exports[name] = exports[name];
     }
   } else {
     // We're being loaded in a JS module.
     global.EXPORTED_SYMBOLS = [];
     for (name in exports) {
       global.EXPORTED_SYMBOLS.push(name);
       global[name] = exports[name];
     }
   }
 })(this);
