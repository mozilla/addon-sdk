
// get title directly
self.postMessage(["assertEqual", document.title, "Page Worker test",
            "Correct page title accessed directly"]);

// get <p> directly
let p = document.getElementById("paragraph");
self.postMessage(["assert", !!p, "<p> can be accessed directly"]);
self.postMessage(["assertEqual", p.firstChild.nodeValue,
            "Lorem ipsum dolor sit amet.",
            "Correct text node expected"]);

// Modify page
let div = document.createElement("div");
div.setAttribute("id", "block");
div.appendChild(document.createTextNode("Test text created"));
document.body.appendChild(div);

// Check back the modification
div = document.getElementById("block");
self.postMessage(["assert", !!div, "<div> can be accessed directly"]);
self.postMessage(["assertEqual", div.firstChild.nodeValue,
            "Test text created", "Correct text node expected"]);
self.postMessage(["done"]);

