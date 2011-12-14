/* vim:set ts=2 sw=2 sts=2 expandtab */
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
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  Irakli Gozalishvili <gozala@mozilla.com> (Original Author)
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

'use strict';

const { Cc, Ci, CC } = require('chrome');
const options = require('@packaging');
const file = require('./file');

const appStartup = Cc['@mozilla.org/toolkit/app-startup;1'].
                   getService(Ci.nsIAppStartup);
const appInfo = Cc["@mozilla.org/xre/app-info;1"].
                getService(Ci.nsIXULAppInfo); 
const runtime = Cc["@mozilla.org/xre/app-info;1"].
                getService(Ci.nsIXULRuntime);

const { eAttemptQuit: E_ATTEMPT, eForceQuit: E_FORCE } = appStartup;

/**
 * Parsed JSON object that was passed via `cfx --static-args "{ foo: 'bar' }"`
 */
exports.staticArgs = options.staticArgs;

/**
 * Environment variables. Environment variables are non-enumerable properties
 * of this object (key is name and value is value).
 */
exports.env = require('./environment').env;

/**
 * Ends the process with the specified `code`. If omitted, exit uses the
 * 'success' code 0. To exit with failure use `1`.
 * TODO: Improve platform to actually quit with an exit code.
 */
exports.exit = function exit(code) {
  // This is used by 'cfx' to find out exit code.
  if ('resultFile' in options) {
    let stream = file.open(options.resultFile, 'w');
    stream.write(code ? 'FAIL' : 'OK');
    stream.close();
  }

  appStartup.quit(code ? E_ATTEMPT : E_FORCE);
};

/**
 * What platform you're running on (all lower case string).
 * For possible values see:
 * https://developer.mozilla.org/en/OS_TARGET
 */
exports.platform = runtime.OS.toLowerCase();

/**
 * What processor architecture you're running on:
 * `'arm', 'ia32', or 'x64'`.
 */
exports.architecture = runtime.XPCOMABI.split('_')[0];

/**
 * What compiler used for build:
 * `'msvc', 'n32', 'gcc2', 'gcc3', 'sunc', 'ibmc'...`
 */
exports.compiler = runtime.XPCOMABI.split('_')[1];

/**
 * The application's build ID/date, for example "2004051604".
 */
exports.build = appInfo.appBuildID;

/**
 * The XUL application's UUID.
 * This has traditionally been in the form
 * `{AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE}` but for some applications it may
 * be: "appname@vendor.tld".
 */
exports.id = appInfo.ID;

/**
 * The name of the application. 
 */
exports.name = appInfo.name;

/**
 * The XUL application's version, for example "0.8.0+" or "3.7a1pre".
 */
exports.version = appInfo.version;

/**
 * XULRunner version.
 */
exports.platformVersion = runtime.platformVersion;


/**
 * The name of the application vendor, for example "Mozilla".
 */
exports.vendor = appInfo.vendor;
