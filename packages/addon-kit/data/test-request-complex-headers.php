<html>
<?php

// Header with extra colon
header('x-zpao-header: Jamba Juice is: delicious');

// same header twice, should be sent twice
header('x-zpao-header-2: foo');
header('x-zpao-header-2: bar', false);

// header with comman seperated values
header('x-zpao-header-3: sup dawg, i heard you like x, so we put a x in yo x so you can y while you y');

// cookies?
setcookie("foo", "bar");
setcookie("baz", "foo");

?>
