/*
 * This file contains utilities for changing the webconsole and its components.
 */

/*
 * TODO:
 *   - Are we sure that this is functionality we couldn't get using existing components?
 *     This seems like a problem with designing a "power user" API.
 *   - Add enable/disable.
 *   - Maybe let there be multiple callbacks for each component.
 *   - for now, we're passing the original flags in so that the user
 *     can call them whenever they want to. This may be good...
 *     but maybe it would be better to let then run arbitrary code
 *     in the context of the webconsole/debugger/whatever? Or maybe
 *     this would be too insecure.
 *   - add renaming layer between VariablesView and user-supplied flags...
 *     because eval/switch/delete are pretty bad names
 *   - consider how we can fix the interface between these flags and devtools
 *     so that it's harder for changes to the devtools to break this API:
 *     - maybe pass the flags to some wrapper around the VV instead of the VV
 *       itself
 *     - or maybe talk to the devtools people about fixing the VV interface
 */

const { Cu } = require("chrome");
const { gDevTools } = Cu.import("resource:///modules/devtools/gDevTools.jsm", {});

/*
 * Overrides/adds flags used to set up a devtools component.
 *
 * @param object options
 *  - string | Array componentIDs: The name of the component to apply this
 *    callback to, or an array of names.
 *  - callback: When provided with the default flags for this component,
 *    this callback should return new flags. Any flags that the callback
 *    returns will override default flags of the same name whenever the
 *    component is created.
 *
 * @throws If a componentID is not valid.
 */
function Flags({componentIDs, callback}) {
	let componentIDs = [].concat(componentIDs);
	componentIDs.forEach(componentID => {
		if (!gDevTools.setAddonFlagsCallback(componentID, callback)) {
			throw new Exception("Failed to set callback for component: " +
				componentID);
		}
	});
}
exports.Flags = Flags;
