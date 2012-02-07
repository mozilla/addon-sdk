<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

Module `uuid` provides low level API for generating / parsing UUID, that may
be necessary when hacking on internals of the platform.


## Generate UUID

Module exports `uuid` function. When called without arguments it will uses
platform-specific methods to obtain a `nsID` that can be considered to be
globally unique.

    let uuid = require('api-utils/uuid').uuid()

## Parsing UUID

Sometimes one might need to create `nsID` from an existing UUID string. Same
`uuid` function may be used to parse such UUID strings into an `nsID`:

    let { uuid } = require('api-utils/uuid');
    let firefoxUUID = uuid('{ec8030f7-c20a-464f-9b0e-13a3a9e97384}');

For more details about UUID representations and what they are used for by the
platform see MDN documentation for
[JSID](https://developer.mozilla.org/en/XPCOM_Interface_Reference/nsIJSID)
