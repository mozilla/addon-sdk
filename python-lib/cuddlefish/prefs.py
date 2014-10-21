# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

DEFAULT_COMMON_PREFS = {
    # allow debug output via dump to be printed to the system console
    # (setting it here just in case, even though PlainTextConsole also
    # sets this preference)
    'browser.dom.window.dump.enabled': True,
    # warn about possibly incorrect code
    'javascript.options.showInConsole': True,

    # Allow remote connections to the debugger
    'devtools.debugger.remote-enabled' : True,

    'extensions.sdk.console.logLevel': 'info',

    'extensions.checkCompatibility.nightly' : False,

    # Disable extension updates and notifications.
    'extensions.update.enabled' : False,
    'lightweightThemes.update.enabled' : False,
    'extensions.update.notifyUser' : False,

    # From:
    # http://hg.mozilla.org/mozilla-central/file/1dd81c324ac7/build/automation.py.in#l372
    # Only load extensions from the application and user profile.
    # AddonManager.SCOPE_PROFILE + AddonManager.SCOPE_APPLICATION
    'extensions.enabledScopes' : 5,
    # Disable metadata caching for installed add-ons by default
    'extensions.getAddons.cache.enabled' : False,
    # Disable intalling any distribution add-ons
    'extensions.installDistroAddons' : False,
    # Allow installing extensions dropped into the profile folder
    'extensions.autoDisableScopes' : 10,

    # shut up some warnings on `about:` page
    'app.releaseNotesURL': 'http://localhost/app-dummy/',
    'app.vendorURL': 'http://localhost/app-dummy/'
}

DEFAULT_NO_CONNECTIONS_PREFS = {
    'toolkit.telemetry.enabled': False,
    'app.update.auto' : False,
    'app.update.url': 'http://localhost/app-dummy/update',
    'media.gmp-gmpopenh264.autoupdate' : False,
    'media.gmp-manager.cert.checkAttributes' : False,
    'media.gmp-manager.cert.requireBuiltIn' : False,
    'media.gmp-manager.url' : 'http://localhost/media-dummy/gmpmanager',
    'browser.newtab.url' : 'about:blank',
    'browser.search.update': False,
    'browser.safebrowsing.enabled' : False,
    'browser.safebrowsing.updateURL': 'http://localhost/safebrowsing-dummy/update',
    'browser.safebrowsing.gethashURL': 'http://localhost/safebrowsing-dummy/gethash',
    'browser.safebrowsing.reportURL': 'http://localhost/safebrowsing-dummy/report',
    'browser.safebrowsing.malware.reportURL': 'http://localhost/safebrowsing-dummy/malwarereport',

    # Disable app update
    'app.update.enabled' : False,

    # Disable about:newtab content fetch and ping
    'browser.newtabpage.directory.source': 'data:application/json,{"jetpack":1}',
    'browser.newtabpage.directory.ping': '',

    # Point update checks to a nonexistent local URL for fast failures.
    'extensions.update.url' : 'http://localhost/extensions-dummy/updateURL',
    'extensions.blocklist.url' : 'http://localhost/extensions-dummy/blocklistURL',
    # Make sure opening about:addons won't hit the network.
    'extensions.webservice.discoverURL' : 'http://localhost/extensions-dummy/discoveryURL'
}

DEFAULT_FENNEC_PREFS = {
  'browser.console.showInPanel': True,
  'browser.firstrun.show.uidiscovery': False
}

# When launching a temporary new Firefox profile, use these preferences.
DEFAULT_FIREFOX_PREFS = {
    'browser.startup.homepage' : 'about:blank',
    'startup.homepage_welcome_url' : 'about:blank',
    'devtools.errorconsole.enabled' : True,
    'devtools.chrome.enabled' : True,

    # From:
    # http://hg.mozilla.org/mozilla-central/file/1dd81c324ac7/build/automation.py.in#l388
    # Make url-classifier updates so rare that they won't affect tests.
    'urlclassifier.updateinterval' : 172800,
    # Point the url-classifier to a nonexistent local URL for fast failures.
    'browser.safebrowsing.provider.0.gethashURL' : 'http://localhost/safebrowsing-dummy/gethash',
    'browser.safebrowsing.provider.0.updateURL' : 'http://localhost/safebrowsing-dummy/update',
}

# When launching a temporary new Thunderbird profile, use these preferences.
# Note that these were taken from:
# http://mxr.mozilla.org/comm-central/source/mail/test/mozmill/runtest.py
DEFAULT_THUNDERBIRD_PREFS = {
    # say no to slow script warnings
    'dom.max_chrome_script_run_time': 200,
    'dom.max_script_run_time': 0,
    # do not ask about being the default mail client
    'mail.shell.checkDefaultClient': False,
    # disable non-gloda indexing daemons
    'mail.winsearch.enable': False,
    'mail.winsearch.firstRunDone': True,
    'mail.spotlight.enable': False,
    'mail.spotlight.firstRunDone': True,
    # disable address books for undisclosed reasons
    'ldap_2.servers.osx.position': 0,
    'ldap_2.servers.oe.position': 0,
    # disable the first use junk dialog
    'mailnews.ui.junk.firstuse': False,
    # other unknown voodoo
    # -- dummied up local accounts to stop the account wizard
    'mail.account.account1.server' :  "server1",
    'mail.account.account2.identities' :  "id1",
    'mail.account.account2.server' :  "server2",
    'mail.accountmanager.accounts' :  "account1,account2",
    'mail.accountmanager.defaultaccount' :  "account2",
    'mail.accountmanager.localfoldersserver' :  "server1",
    'mail.identity.id1.fullName' :  "Tinderbox",
    'mail.identity.id1.smtpServer' :  "smtp1",
    'mail.identity.id1.useremail' :  "tinderbox@invalid.com",
    'mail.identity.id1.valid' :  True,
    'mail.root.none-rel' :  "[ProfD]Mail",
    'mail.root.pop3-rel' :  "[ProfD]Mail",
    'mail.server.server1.directory-rel' :  "[ProfD]Mail/Local Folders",
    'mail.server.server1.hostname' :  "Local Folders",
    'mail.server.server1.name' :  "Local Folders",
    'mail.server.server1.type' :  "none",
    'mail.server.server1.userName' :  "nobody",
    'mail.server.server2.check_new_mail' :  False,
    'mail.server.server2.directory-rel' :  "[ProfD]Mail/tinderbox",
    'mail.server.server2.download_on_biff' :  True,
    'mail.server.server2.hostname' :  "tinderbox",
    'mail.server.server2.login_at_startup' :  False,
    'mail.server.server2.name' :  "tinderbox@invalid.com",
    'mail.server.server2.type' :  "pop3",
    'mail.server.server2.userName' :  "tinderbox",
    'mail.smtp.defaultserver' :  "smtp1",
    'mail.smtpserver.smtp1.hostname' :  "tinderbox",
    'mail.smtpserver.smtp1.username' :  "tinderbox",
    'mail.smtpservers' :  "smtp1",
    'mail.startup.enabledMailCheckOnce' :  True,
    'mailnews.start_page_override.mstone' :  "ignore",
}

DEFAULT_TEST_PREFS = {
    'general.useragent.locale': "en-US",
    'intl.locale.matchOS': "en-US"
}
