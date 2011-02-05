# Annotator Design Overview #

The annotator uses content scripts to build user interfaces, get user input,
and examine the DOM of pages loaded by the user.

Meanwhile the `main` module contains the application logic and mediates
interactions between the different SDK objects.

We could represent the overall design as follows:

<div align="center">
<img src="media/annotator/annotator-design.png" alt="Annotator Design">
</div>

## User Interface ##

The annotator's main user interface consists of a widget and three panels.

* The widget is used to switch the annotator on and off, and to display a list
of all the stored annotations.

* The **annotation-editor** panel enables the user to enter a new annotation.

* The **annotation-list** panel shows a list of all stored annotations.

* The **annotation** panel displays a single annotation.

Additionally, we use the `notifications` module to notify the user when the
add-on's storage quota is full.

## Working with the DOM ##

We'll use two page-mods:

* The **selector** enables the user to choose an element to annotate.
It identifies page elements which are eligible for annotation, highlights them
on mouseover, and tells the main add-on code when the user clicks a highlighted
element.

* The **annotator** is responsible for finding annotated elements: it is
initialized with the list of annotations and searches web pages for the
elements they are associated with. It highlights any annotated elements that
are found. When the user moves the mouse over an annotated element
the annotator tells the main add-on code.

## Working with Data ##

We'll use the `simple-storage` module to store annotations.

Because we are recording potentially sensitive information, we want to prevent
the user creating annotations when in private browsing mode, so we'll use the
`private-browsing` module for that.
