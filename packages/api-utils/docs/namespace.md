Provides an API for creating namespaces for any given objects, which
effectively may be used for storing private data associated with a given
object.

    let { Namespace } = require("api-utils/namespace");
    let _ = Namespace()

    _(publicAPI).secret = secret

Also, note that one namespace can be used for multiple objects and multiple
namespaces can be used with one object. In addition access to the namespace
can be shared by just handing them a namespace access function `_`.
