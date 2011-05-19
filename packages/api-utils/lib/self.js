
let file = require("file");
let url = require("url");

let jid = packaging.jetpackID;
let name = packaging.options.name;

// Some XPCOM APIs require valid URIs as an argument for certain operations (see
// `nsILoginManager` for example). This property represents add-on associated
// unique URI string that can be used for that.
let uri = "addon:" + jid;

exports.makeSelfModule = function (reqdata) {
  // a module loaded from URI has called require(MODULE)
  // URI is like resource://jid0-$JID/$PACKAGE-$SECTION/$SUBDIR/$FILENAME
  // resource://jid0-abc123/reading-data-lib/main.js
  // and we want resource://jid0-abc123/reading-data-data/

  var data_url = function(name) {
    // dataURIPrefix ends with a slash
    var x = reqdata.dataURIPrefix + name;
    return x;
  };
  var data_load = function(name) {
    let fn = url.toFilename(data_url(name));
    return file.read(fn);
  };
    
  var self = {
    id: jid,
    uri: uri,
    data: {
      load: data_load,
      url: data_url
    }
  };
  return self;
};

