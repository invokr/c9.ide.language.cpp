c9.ide.language.cpp
===================

This plugin provides C / C++ language additions to Cloud9 v3 (http:://c9.io).

These features are currently implemented:

 * Code completion
 * Linting and Diagnostics
 * File Outline (Classes, Functions, Includes)

These features are planned:

 * Jump to Definition / Declaration
 * Full Clang-AST to JS converter (including documentation blocks)
 * Type under cursor
 * auto / typename / decltype Type resolution under cursor
 * Better Icons

Code completion and linting are implemented using clang's libclang-c bindings.
The initial parse of each translation unit (.c, .h) can take up to one second,
depending on the number and complexity of additional files to parse.

Time for subsequent parses is greatly improved due to the build-in cache.

![Image](https://raw.github.com/invokr/c9.ide.language.cpp/master/screenshot.png)

Requirements
------------

 * libclang, libllvm
 * clang_tool (npm)
 * Linux, FreeBSD, OS X (untested but should work in theory)

Installation on a local c9v3 instance
-------------------------------------

 * Install the cloud9-sdk as per the instructions in the official repository
 * Install libclang and libllvm for your platform
 * `cd <c9-sdk-folder>`
 * `npm install clang_tool`
   * If the above fails, make sure libllvm and libclang are installed
   * Clone the [clang_tool repository](https://github.com/invokr/clang-tool-node): `git clone <r> node_modules/clang_tool`
   * Check if the correct include path is set in `bindings.gyp`
   * Run `node-gyp configure && node-gyp build`
 * Add the plugin to `<c9-sdk-foler>/configs/client-default.js` (e.g. in line 289)

The following packages are necessary for debian jessie: `llvm-3.5`, `clang-3.5`, `libclang-3.5-dev`

Installation on c9.io
---------------------

Run the following in `~` (via the c9 terminal):

    # Install native dependencies
    sudo apt-get install llvm-3.5 llvm-3.5-dev lvm-3.5-runtime libclang-3.5-dev libclang1-3.5 clang-format-3.5

    # Install clang_tool
    npm install clang_tool

    # Install the plugin
    mkdir ~/.c9/plugins && git clone https://github.com/invokr/c9.ide.language.cpp ~/.c9/plugins/c9.ide.language.cpp

    # Start cloud9 in debug mode to activate the plugin
    https://ide.c9.io/[username]/[project]?sdk=1&debug=2

License
-------

c9.ide.language.cpp is licensed under the AGPL version 3
