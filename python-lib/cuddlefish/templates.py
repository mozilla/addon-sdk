#Template used by main.js
MAIN_JS = '''\
const widgets = require("widget");
const tabs = require("tabs");
const panels = require("panel");
const data = require("self").data;

let my_widget = widgets.Widget({
    label:"Mozilla website",
    contentURL:"http://www.mozilla.org/favicon.ico",
    onClick:function(e){
        tabs.open("http://mozilla.org");
    }
});

console.log("Jetpack sample addon running.");
/*Your code is here below*/

'''

#Template used by test-main.js
TEST_MAIN_JS = '''\
const main = require("main");

exports.test_test_run = function(test){
    test.pass("Unit test running!");
}

exports.test_id = function(test){
    test.assert(require("self").id.length > 0);
}

exports.test_url = function(test){
    require("request").Request({
        url:"http://www.mozilla.org",
        onComplete:function(response){
            test.assertEqual(response.statusText,"OK");
            test.done();
        }
    }).get();
    test.waitUntilDone(20000);
}

exports.test_open_tab = function(test){
    const tabs = require("tabs");
    tabs.open({
        url : "http://www.mozilla.org",
        onReady : function(tab){
            test.assertEqual(tab.url,"http://www.mozilla.org/");
            test.done();
        }
    });
    test.waitUntilDone(20000);
}

'''

#Template used by main.md
MAIN_JS_DOC = '''\
Documentation about main function.

'''

#Template used by README.md
README_DOC = '''\
This is my %(name)s package. It contains:
* A main module.
* A main test.
* Some meager documentation.

'''

#Template used by package.json
PACKAGE_JSON = '''\
{
    "name":"%(name)s",
    "fullName":"%(name)s",
    "description":"This is an example of addon description.",
    "author":"",
    "license":"MPL",
    "version":"0.1"
}

'''
