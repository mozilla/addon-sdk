var font = require('./ansi-font');
var { isUndefined, isNull, isString, isFunction, isArray, isObject } = require('./type');

exports.serialize = function serialize(value, indent, limit, offset, visited) {
  var result;
  var names;
  var nestingIndex;
  var isCompact = !isUndefined(limit);

  indent = indent || "    ";
  offset = (offset || "");
  result = "";
  visited = visited || [];

  if (isUndefined(value)) {
    result += font.magenta('undefined');
  }
  else if (isNull(value)) {
    result += font.magenta('null');
  }
  else if (isString(value)) {
    result += font.green('"' + value + '"');
  }
  else if (isFunction(value)) {
    value = String(value).split("\n");
    if (isCompact && value.length > 2) {
      value = value.splice(0, 2);
      value.push("..." + font.cyan("}"));
    }
    result += value.join("\n" + offset).
                    replace(/\{|\}|\(|\)/g, font.cyan).
                    replace('function', font.yellow);
  }
  else if (isArray(value)) {
    if ((nestingIndex = (visited.indexOf(value) + 1))) {
      result = font.blue("#" + nestingIndex + "#");
    }
    else {
      visited.push(value);

      if (isCompact)
        value = value.slice(0, limit);

      result += font.cyan("[\n");
      result += value.map(function(value) {
        return offset + indent + serialize(value, indent, limit, offset + indent,
                                        visited);
      }).join(",\n");
      result += isCompact && value.length > limit ?
                ",\n" + offset + "..." + font.cyan("]") :
                "\n" + offset + font.cyan("]");
    }
  }
  else if (isObject(value)) {
    if ((nestingIndex = (visited.indexOf(value) + 1))) {
      result = font.blue("#" + nestingIndex + "#");
    }
    else {
      visited.push(value)

      names = Object.keys(value);

      result += font.cyan("{")
      try { // This may throw Illegal operation on WrappedNative
        result += font.color(101, " // " + String(value) + "\n");
      } catch (e) {}
      result += (isCompact ? names.slice(0, limit) : names).map(function(name) {
        var _limit = isCompact ? limit - 1 : limit;
        var descriptor = Object.getOwnPropertyDescriptor(value, name);
        var result = offset + indent + font.color(101, "// ");
        var accessor;
        if (0 <= name.indexOf(" "))
          name = font.green('"' + name + '"');

        if (descriptor.writable)
          result += font.color(101, "writable ");
        if (descriptor.configurable)
          result += font.color(101, "configurable ");
        if (descriptor.enumerable)
          result += font.color(101, "enumerable ");

        result += "\n";
        if ("value" in descriptor) {
          result += offset + indent + name + ": ";
          result += serialize(descriptor.value, indent, _limit, indent + offset,
                           visited);
        }
        else {

          if (descriptor.get) {
            result += offset + indent + "get " + name + " ";
            accessor = serialize(descriptor.get, indent, _limit, indent + offset,
                              visited);
            result += accessor.substr(accessor.indexOf("{"));
          }

          if (descriptor.set) {
            result += offset + indent + "set " + name + " ";
            accessor = serialize(descriptor.set, indent, _limit, indent + offset,
                              visited);
            result += accessor.substr(accessor.indexOf("{"));
          }
        }
        return result;
      }).join(",\n");

      if (isCompact) {
        if (names.length > limit && limit > 0) {
          result += ",\n" + offset  + indent + font.color(101, "//...");
        }
      }
      else {
        if (names.length)
          result += ",";

        result += "\n" + offset + indent + font.yellow('"__proto__"') + ': ';
        result += serialize(Object.getPrototypeOf(value), indent, 0,
                         offset + indent);
      }

      result += "\n" + offset + font.cyan("}");
    }
  }
  else {
    result += String(value);
  }
  return result
}
