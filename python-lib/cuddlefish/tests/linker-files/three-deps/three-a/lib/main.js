exports.main = 42;
require("./subdir/subfile");
require("self"); // trigger inclusion of our data/ directory

