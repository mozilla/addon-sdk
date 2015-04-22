"use strict";

const {run, install, uninstall, Conversion, Status} = require("dev/gcli");

exports["test gcli run"] = function*(assert) {
  const result = yield run("help");
  assert.ok(Array.isArray(result.commands),
            "help returns array of commands");
};

exports["test gcli failed run"] = function*(assert) {
  try {
    const result = yield run("hlep");
    assert.fail("should have rejected promise");
  } catch (error) {
    assert.ok(error);
    assert.equal(error.message, "Invalid Command");
  }
};

exports["test install / uninstall command"] = function*(assert) {
  const command = {
    name: "echo",
    description: "Returns same text back",
    params: [{name: "text",
              type: "string",
              description: "text to echo"}],
    exec({text}) {
      return text;
    }
  };

  install(command);

  const r1 = yield run("help echo");

  assert.ok(r1.command, "returns command");
  assert.equal(r1.command.description, command.description);
  assert.equal(r1.command.name, command.name);
  assert.equal(r1.command.params.length, command.params.length);
  assert.equal(r1.command.params[0].name, command.params[0].name);
  assert.equal(r1.command.params[0].description, command.params[0].description);

  try {
    const r2 = yield run("echo");
    assert.fail("should have errored");
  } catch(error) {
    assert.equal(error.message, "Value required for 'text'.");
  }

  const r3 = yield run("echo Hi");

  assert.equal(r3, "Hi")

  uninstall(command);

  try {
    const r4 = yield run("echo Bye");
    assert.fail("should have errored");
  } catch(error) {
    assert.equal(error.message, "Invalid Command");
  }
};

require("sdk/test").run(exports);
