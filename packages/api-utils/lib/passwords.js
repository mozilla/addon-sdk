/*jslint forin: true, rhino: true, onevar: false, browser: true, evil: true, laxbreak: true, undef: true, nomen: true, eqeqeq: true, bitwise: true, maxerr: 1000, immed: false, white: false, plusplus: false, regexp: false, undef: false */
// Released under the MIT/X11 license
// http://www.opensource.org/licenses/mit-license.php
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
