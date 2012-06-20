const { Cc, Ci } = require("chrome");
const AddonInstaller = require("api-utils/addon/installer");
const file = require("api-utils/file");
const system = require("api-utils/system");
const xpi = require("./xpi");
const { CfxError } = require("./exception");

function getOptions() {
  let optionsFile = system.env["CFX_OPTIONS_FILE"];
  if (!optionsFile) {
    throw new Error("Unable to locate options file, environnement not set.");
  }
  let data = null;
  try {
    data = file.read(optionsFile);
  }
  catch(e) {
    throw new Error("Unable to read options file: " + optionsFile + "\n" + e);
  }
  return JSON.parse(data);
}

function main() {
  let { command, options } = getOptions();
  if (command === "install-xpi") {
    AddonInstaller.install(options.path)
                  .then(
                    null,
                    function onError(error) {
                      console.log("Failed to install addon: " + error);
                    });
  }
  else if (command === "build-xpi") {
    xpi.build(options);
  }
  else if (command == "no-quit") {
    // Test command in order to simulate a run that never quits
    Cc['@mozilla.org/toolkit/app-startup;1'].
      getService(Ci.nsIAppStartup).
      enterLastWindowClosingSurvivalArea();
  }
  else {
    console.log("Unknown cfxjs command '" + command + "'");
  }
}

try {
  if (require.main === module)
    main();
}
catch(e) {
  if (e instanceof CfxError) {
    // Stacktrace isn't usefull in case of custom cfx exceptions,
    // prints custom message instead
    dump(e.toString() + "\n");
  }
  else {
    console.error("Unknown internal error in cfx.js:");
    console.exception(e);
  }
  system.exit(system.E_FORCE);
}
