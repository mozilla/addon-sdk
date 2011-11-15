
function setLibraryInfo(element) {
  self.port.emit('setLibraryInfo', element.target.title);
}

var elements = document.getElementsByTagName('img');

for (var i = 0; i < elements.length; i++) {
  elements[i].addEventListener('mouseover', setLibraryInfo, false);
}
