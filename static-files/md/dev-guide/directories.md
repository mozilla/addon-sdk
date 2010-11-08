<!-- contributed by Noelle Murata [fiveinchpixie@gmail.com] (test) -->
This is a map of the Add-on SDK directory structure.

* **bin**:  executable scripts for command line use
* **examples**:  example packages
* **python-lib**:  core Python libraries for operating the SDK framework
* **packages**:  main packages directory. Core packages, packages obtained from others and packages created locally live here
    * **jetpack-core**:  core modules, tests, documentation and package manifest

        * **docs**:  Markdown files documenting the APIs
        * **lib**:  JavaScript modules
        * **tests**: unit tests
        * **package.json**: package manifest for the library

    * **development-mode**:  development-mode library and package manifest
    * **test-harness**:  test harness module, unit tests, documentation and package manifest

* **static-files**:  static files driving the docs mini-server

