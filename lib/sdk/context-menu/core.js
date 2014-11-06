"use strict";


const Contexts = require("./context");
const Readers = require("./readers");
const Component = require("../ui/component");
const { Class } = require("../core/heritage");
const { map, filter, object, reduce, keys, symbols,
        pairs, values, each, some } = require("../util/sequence");
const { loadModule } = require("framescript/manager");
const { Cc, Ci, Cr } = require("chrome");

const globalMessageManager = Cc["@mozilla.org/globalmessagemanager;1"]
                              .getService(Ci.nsIMessageListenerManager);


const readTable = Symbol("context-menu/read-table");
const nameTable = Symbol("context-menu/name-table");
const onContext = Symbol("context-menu/on-context");

exports.onContext = onContext;
exports.readTable = readTable;
exports.nameTable = nameTable;


const propagateOnContext = (item, data) =>
  each(child => child[onContext](data), item.state.children);

const isMatchingContextHandler = ({state: {options, target}}) =>
  options.context ? some(context => context.isCurrent(target), options.context) : true;


const weakMessageListener = f => function listener(message) {
  try {
    f(message);
  } catch (error) {
    if (error.message.contains("can't access dead object")) {
      message.target.messageManager.removeMessageListener(message.name, listener);
    }
    else {
      throw error;
    }
  }
}

const onMessage = Symbol("context-menu/message-listener");
const ContextMenuExtension = Class({
  extends: Component,
  initialize: Component,
  setup() {
    this[onMessage] = weakMessageListener(this[onMessage].bind(this));
    loadModule(globalMessageManager, "framescript/context-menu", true, "onContentFrame");
    globalMessageManager.addMessageListener("sdk/context-menu/read", this[onMessage]);
    globalMessageManager.addMessageListener("sdk/context-menu/readers?", this[onMessage]);
  },
  [onMessage]({name, data, target}) {
    if (name === "sdk/context-menu/read")
      this[onContext]({target, data});
    if (name === "sdk/context-menu/readers?")
      target.messageManager.sendAsyncMessage("sdk/context-menu/readers",
                                             JSON.parse(JSON.stringify(this.state.readers)));
  },
  [Component.initial](options={}, children) {
    const element = options.element || null;
    const target = options.target || null;
    const readers = Object.create(null);
    const users = Object.create(null);
    return { target, children: [], readers, users, element };
  },
  [Component.isUpdated](before, after) {
    return before.target !== after.target
  },
  [Component.render]({children, element}) {
    const items = children.filter(isMatchingContextHandler);

    return {
      element: element,
      tagName: "menugroup",
      style: "-moz-box-orient: vertical;",
      id: "context-menu-extension",
      children: items.length ? [new Seperator(), ...items] : items
    }
  },
  // Adds / remove child to it's own list.
  add(item) {
    this[Component.patch]({children: this.state.children.concat(item)});
  },
  remove(item) {
    this[Component.patch]({
      children: this.state.children.filter(x => x !== item)
    });
  },
  register(item) {
    // Each (ContextHandler) item has a readTable that is a
    // map of keys to readers extracting them from the content.
    // During the registraction we update intrnal record of unique
    // readers and users per reader. Most context will have a reader
    // shared across all instances there for map of users per reader
    // is stored separately from the reader so that removing reader
    // will occur only when no users remain.
    const table = item[readTable];
    // Context readers store data in private symbols so we need to
    // collect both table keys and private symbols.
    const names = [...keys(table), ...symbols(table)];
    const readers = map(name => table[name], names);
    // Create delta for registered readers that will be merged into
    // internal readers table.
    const added = filter(x => !this.state.users[x.id], readers);
    const delta = object(...map(x => [x.id, x], added));

    const users = reduce((users, reader) => {
      const n = users[reader.id] || 0;
      users[reader.id] = n + 1;
      return users;
    }, this.state.users, readers);

    // Patch current state with a changes that registered item caused.
    this[Component.patch]({users: users,
                           readers: Object.assign(this.state.readers, delta)});

    globalMessageManager.broadcastAsyncMessage("sdk/context-menu/readers", JSON.parse(JSON.stringify(delta)));

  },
  unregister(item) {
    const { users } = this.state;
    const table = item[readTable];
    const names = [...keys(table), ...symbols(table)];
    const readers = map(name => table[name], names);
    const existing = filter(x => users[x.id], readers);
    const update = reduce((update, reader) => {
      update[reader.id] = users[reader.id] - 1;
      return update;
    }, {}, existing);
    const removed = filter(id => !update[id], keys(update));
    const delta = object(...map(x => [x, null], removed));

    this[Component.patch]({users: Object.assign(users, update),
                           readers: Object.assign(this.state.readers, delta)});

    globalMessageManager.broadcastAsyncMessage("sdk/context-menu/readers", JSON.parse(JSON.stringify(delta)));
  },

  [onContext]({data, target}) {
    propagateOnContext(this, data);
    const document = target.ownerDocument;
    const element = document.getElementById("contentAreaContextMenu");

    console.log("sdk/context-menu/read", data, target);

    this[Component.patch]({target: data, element: element});
  }
});this,
exports.ContextMenuExtension = ContextMenuExtension;

// Takes an item options and
const makeReadTable = ({context, read}) => {
  // Result of this function is a tuple of all readers &
  // name, reader id pairs.

  // Filter down to contexts that have a reader associated.
  const contexts = filter(context => context.read, context);
  // Merge all contexts read maps to a single hash, note that there should be
  // no name collisions as context implementations expect to use private
  // symbols for storing it's read data.
  return Object.assign({}, ...map(({read}) => read, contexts), read);
}

const readTarget = (nameTable, data) =>
  object(...map(([name, id]) => [name, data[id]], nameTable))

const ContextHandler = Class({
  extends: Component,
  initialize: Component,
  get context() {
    return this.state.options.context;
  },
  get read() {
    return this.state.options.read;
  },
  [Component.initial](options) {
    return {
      table: makeReadTable(options)
    }
  },
  setup() {
    const table = makeReadTable(this.state.options);
    this[readTable] = table;
    this[nameTable] = [...map(symbol => [symbol, table[symbol].id], symbols(table)),
                       ...map(name => [name, table[name].id], keys(table))];


    contextMenu.register(this);

    each(child => contextMenu.remove(child), this.state.children);
    contextMenu.add(this);
  },
  dispose() {
    contextMenu.remove(this);
    
    each(child => contextMenu.unregister(child), this.state.children);
    contextMenu.unregister(this);
  },
  // Internal `Symbol("onContext")` method is invoked when "contextmenu" event
  // occurs in content process. Context handles with children delegate to each
  // child and patch it's internal state to reflect new contextmenu target.
  [onContext](data) {
    propagateOnContext(this, data);
    this[Component.patch]({target: readTarget(this[nameTable], data)});
  }
});
exports.ContextHandler = ContextHandler;

const Menu = Class({
  extends: ContextHandler,
  [Component.render]({children, options}) {
    const items = children.filter(isMatchingContextHandler);
    return {tagName: "menu",
            className: "addon-context-menu menu-iconic",
            label: options.label,
            accesskey: options.accesskey,
            image: options.icon,
            children: [{
              tagName: "menupopup",
              children: items}]};
  }
});
exports.Menu = Menu;


const Item = Class({
  extends: ContextHandler,
  get onClick() {
    return this.state.onClick;
  },
  [Component.render]({options}) {
    const {label, icon, accesskey} = options;
    return {tagName: "menuitem",
            className: "addon-context-menu-item menuitem-iconic",
            label,
            accesskey,
            image: icon};
  },
  handleEvent(event) {
    if (this.onClick)
      this.onClick(this.state.target);
  }
});
exports.Item = Item;

var Seperator = Class({
  extends: Component,
  initialize: Component,
  [Component.render]() {
    return {tagName: "menuseparator",
            className: "addon-context-menu-separator"}
  },
  [onContext]() {

  }
});
exports.Seperator = Seperator;

exports.Contexts = Contexts;
exports.Readers = Readers;

const createElement = (vnode, {document}) => {
   const node = vnode.namespace ?
              document.createElementNS(vnode.namespace, vnode.tagName) :
              document.createElement(vnode.tagName);

   each(([key, value]) => {
     if (key === "tagName") {
       return;
     }
     if (key === "children") {
       return;
     }

     if (key.startsWith("on")) {
       node.addEventListener(key.substr(2).toLowerCase(), value)
       return;
     }

     if (typeof(value) !== "object" &&
         typeof(value) !== "function" &&
         value !== void(0) &&
         value !== null)
    {
       node.setAttribute(key, value);
       return;
     }
   }, pairs(vnode));

  each(child => node.appendChild(createElement(child, {document})), vnode.children);
  return node;
};

const htmlWriter = tree => {
  const root = tree.element;
  const node = createElement(tree, {document: root.ownerDocument});
  const before = root.querySelector(`#${node.id}`);
  if (before) {
    root.replaceChild(node, before);
  } else {
    root.appendChild(node);
  }
};


const contextMenu = ContextMenuExtension();
exports.contextMenu = contextMenu;
Component.mount(contextMenu, htmlWriter);
