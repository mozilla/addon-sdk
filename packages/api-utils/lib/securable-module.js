/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Jetpack.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Atul Varma <atul@mozilla.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
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
         options.fs = new exports.CompositeFileSystem(fses);
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
     this.module_infos = {};
     this.globals = options.globals;
     this.getModuleExports = options.getModuleExports;
     this.modifyModuleSandbox = options.modifyModuleSandbox;
     this.securityPolicy = options.securityPolicy;
   };

   // START Support functions for Async module-style
   var ostring = Object.prototype.toString;
   function isFunction(it) {
     return ostring.call(it) === "[object Function]";
   }
   function isArray(it) {
     return ostring.call(it) === "[object Array]";
   }
   // END Support functions for Async module-style

   exports.Loader.prototype = {
     _makeApi: function _makeApi(basePath) {
       var self = this;

       function require(module) {
         var exports;

         if (self.getModuleExports)
           exports = self.getModuleExports(basePath, module);

         var module_info = null; /* null for require("chrome") */
         if (!exports) {
           var path = self.fs.resolveModule(basePath, module);
           if (!path)
             throw new Error('Module "' + module + '" not found');

           // Track accesses to this module via its normalized path
           if (!self.pathAccessed[path]) {
             self.pathAccessed[path] = 0;
           }
           self.pathAccessed[path] += 1;

           if (path in self.modules) {
             module_info = self.module_infos[path];
           } else {
             module_info = self.fs.getFile(path);
             /* module_info.filename is read by sandbox.evaluate() to
                generate tracebacks, so the property must be named
                ".filename" even though ".url" might be more accurate */
             if (module_info.filename === undefined)
               module_info.filename = path;

             if (self.securityPolicy &&
                 !self.securityPolicy.allowEval(self, basePath, module,
                                                module_info))
               throw new Error("access denied to execute module: " +
                               module);

             var sandbox = self.sandboxFactory.createSandbox(module_info);
             self.sandboxes[path] = sandbox;
             for (name in self.globals)
               sandbox.defineProperty(name, self.globals[name]);
             var api = self._makeApi(path);
             sandbox.defineProperty('require', api.require);
             sandbox.defineProperty('define', api.define);
             // Override the default Iterator function with one that passes
             // a second argument to custom iterator methods that identifies
             // the call as originating from an Iterator function so the custom
             // iterator method can return [key, value] pairs just like default
             // iterators called via the default Iterator function.
             sandbox.defineProperty('Iterator',
               (function(DefaultIterator) {
                 return function Iterator(obj, keysOnly) {
                   if ("__iterator__" in obj && !keysOnly)
                     return obj.__iterator__.call(obj, false, true);
                   return DefaultIterator(obj, keysOnly);
                 };
               })(sandbox.globalScope.Iterator)
             );
             sandbox.evaluate("var exports = {};");
             self.modules[path] = sandbox.getProperty("exports");
             self.module_infos[path] = module_info;
             if (self.modifyModuleSandbox)
               self.modifyModuleSandbox(sandbox, module_info);
             sandbox.evaluate(module_info);
           }
           exports = self.modules[path];
         }

         if (self.securityPolicy &&
             !self.securityPolicy.allowImport(self, basePath, module,
                                              module_info, exports))
           throw new Error("access denied to import module: " + module);

         return exports;
       };

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
           return require(deps);
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
         if (!isArray(deps)) {
           callback = deps;
           deps = null;
         }

         // Set up the path if we have a name
         if (name) {
           namePath = self.fs.resolveModule(basePath, name);
         }

         // If the callback is not an actual function, it means it already
         // has the definition of the module as a literal value.
         if (!deps && callback && !isFunction(callback)) {
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

         if (isFunction(deps)) {
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
               var overridden;
               if (self.getModuleExports)
                 overridden = self.getModuleExports(basePath, dep);
               if (overridden) {
                 depModules.push(overridden);
                 return;
               }

               var depPath = self.fs.resolveModule(basePath, dep);

               if (!self.modules[depPath]) {
                 require(dep);
               }
               depModules.push(self.modules[depPath]);
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

     require: function require(module) {
       return (this._makeApi(null).require)(module);
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

   exports.CompositeFileSystem = function CompositeFileSystem(fses) {
     this.fses = fses;
     this._pathMap = {};
   };

   exports.CompositeFileSystem.prototype = {
     resolveModule: function resolveModule(base, path) {
       for (var i = 0; i < this.fses.length; i++) {
         var fs = this.fses[i];
         var absPath = fs.resolveModule(base, path);
         if (absPath) {
           this._pathMap[absPath] = fs;
           return absPath;
         }
       }
       return null;
     },
     getFile: function getFile(path) {
       return this._pathMap[path].getFile(path);
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
       path = path + ".js";

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
       return {contents: data};
     }
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
