/* vim:set ts=2 sw=2 sts=2 et: */
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
 * The Original Code is Jetpack Packages.
 *
 * The Initial Developer of the Original Code is Red Hat.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Matěj Cepl <mcepl@redhat.com> (Original Author)
 *   Irakli Gozalishvili <gozala@mozilla.com>
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

"use strict";

var Cc = require("chrome").Cc;
var Ci = require("chrome").Ci;
var components = require("chrome").components;

function getLoginInfo(username, pass,
        domain, realm) {
    var nsLoginInfo = new components.
        Constructor("@mozilla.org/login-manager/loginInfo;1",
            Ci.nsILoginInfo, "init");
    return new nsLoginInfo(domain,
        null, realm, username, pass, "", "");
}

function getPasswordManager() {
    return Cc["@mozilla.org/login-manager;1"].
        getService(Ci.nsILoginManager);
}

exports.setLogin = function setLogin (username, pass,
        domain, realm)  {
    var lInfo = getLoginInfo(username, pass, domain, realm);
    getPasswordManager().addLogin(lInfo);
};

var getPassword = exports.getPassword = function getPassword(username,
    domain, realm)  {

    var pwMgr = getPasswordManager();
    var logins = pwMgr.findLogins({}, domain, "", realm);
    var ourLogins = Array.filter(logins, function (x) {
        return (x.username = username);
    }, this);
    // What to do when we have more than one password?
    if (ourLogins.length > 0) {
        return ourLogins[0].password;
    } else {
        return null;
    }
};

exports.removeLogin = function removeLogin(username,
    domain, realm) {
    var pass = getPassword(username, domain, realm);
    var pwMgr = getPasswordManager();
    var logins = pwMgr.findLogins({}, domain, "", realm);

    // Don't do Array.forEach here ... emulating break there
    // is an abomination
    for (var i = 0, ii = logins.length; i < ii; i++) {
        if (logins[i].username === username) {
            pwMgr.removeLogin(logins[i]);
            break;
        }
    }
};
