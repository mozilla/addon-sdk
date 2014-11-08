"use strict";


const { query, constant, cache } = require("sdk/lang/functional");
const { pairs, each, map, object } = require("sdk/util/sequence");
const { nodeToMessageManager } = require("./util");

const Null = constant(null);

const read = node =>
  object(...map(([id, reader]) => [id, reader(node)], pairs(readers)));
const readers = Object.create(null);


const parse = descriptor => (parsers[descriptor.category] || Null)(descriptor);

const parsers = Object.create(null)
parsers["reader/MediaType()"] = constant(node => {
  return "mediaType not supported yet";
});
parsers["reader/Link()"] = _ => constant(node => {
  return "link not supported yet";
});
parsers["reader/Selection()"] = constant(node => {
  return "selection not supported yet";
});
// Improve performance by memomizing generated functions.
parsers["reader/Query()"] = ({path}) => query(path);
parsers["reader/Attribute()"] = ({name}) => node => node.getAttribute(name);
parsers["reader/Extractor"] = ({source}) => (Function("(" + source + ")"))();
parsers["reader/isPage()"] = () => () => true;
parsers["reader/isFrame()"] = () => () => false;
parsers["reader/SelectorMatch()"] = ({selector}) => node => node.matches(selector);


const onReadersUpdate = message => {
  console.log("sdk/context-menu/readers", JSON.stringify(message.data, 2, 2));
  each(([id, descriptor]) => {
    if (descriptor)
      readers[id] = parse(descriptor);
    else
      delete readers[id];
  }, pairs(message.data));
};
exports.onReadersUpdate = onReadersUpdate;

const onContextMenu = event => {
  if (!event.defaultPrevented) {
    const manager = nodeToMessageManager(event.target);
    manager.sendSyncMessage("sdk/context-menu/read", read(event.target), readers);
  }
};
exports.onContextMenu = onContextMenu;


const onContentFrame = (frame) => {
  frame.addEventListener("contextmenu", onContextMenu);
  frame.addMessageListener("sdk/context-menu/readers", onReadersUpdate);
  frame.sendSyncMessage("sdk/context-menu/readers?");
};
exports.onContentFrame = onContentFrame;
