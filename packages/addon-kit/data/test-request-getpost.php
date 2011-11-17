<?php

// print("GET: ");
// print_r($_GET);
// 
// print("POST: ");
// print_r($_POST);
// //print($_POST["p"]);
$out = array(
  "POST" => $_POST,
  "GET" => $_GET
);
print(json_encode($out));
?>
