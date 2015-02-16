c9.ide.language.cpp
===================

This plugin provides C / C++ language additions to Cloud9 v3 (http:://c9.io).

These features are currently implemented:

 * Code completion
 * Linting

Code completion and linting are implemented using clang's libclang-c bindings.
The initial parse of each translation unit (.c, .h) can take up to ten seconds,
depending on the number and complexity of includes.

Time for subsequent parses is greatly improved due to the build-in cache.

Drawbacks
---------

To emit the correct completion results, the current contents of the file are written
to a temporary file in the same folder. This file is automatically cleaned up once the
completion is finished.

Requirements
------------

 - libclang-c
 - clang-autocomplete (npm)

Installation on a local c9v3 instance
-------------------------------------

Installation on c9.io
---------------------

License
-------

c9.ide.language.cpp is licensed under the AGPL version 3