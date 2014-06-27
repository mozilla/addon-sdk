/*
 * This addon hides the public fields of objects displayed in the VariablesView.
 */

const { Flags } = require("dev/flags");

const keyFilter = (obj, cond) => {
	let keys = Object.keys(obj).filter(cond);
	return keys.reduce((newObj, key) => {
		newObj[key] = obj[key];
		return newObj;
	}, {});
};

// Returns only the properties of an object which keys that
// are public (i.e. do no start with a "_").
const filterPublic = obj => keyFilter(obj, key => key[0] !== "_");

// Decorates and object grip client so that its `getPrototypeAndProperties`
// method only displays public properties of `ownProperties` or `prototype`.
const decorateClient = client => {
  let _getPrototypeAndProperties = client.getPrototypeAndProperties.bind(client);

  client.getPrototypeAndProperties = (callback => {
  	_getPrototypeAndProperties(({ownProperties, prototype}) => {
			callback({
				ownProperties: filterPublic(ownProperties),
				prototype: filterPublic(prototype)
			});
		});
	}).bind(client);

	return client;
};

// The debugger and webconsole will show only public fields of object in their
// VariablesViews.
Flags({
	componentIDs: [
		"debugger-variables-view-controller",
		"webconsole-variables-view-controller"
	],
	callback: defaultFlags => ({
		getObjectClient: grip => {
			let defaultClient = defaultFlags.getObjectClient(grip);
      return decorateClient(defaultClient);
		}
	})
});
