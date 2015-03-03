/**
 * Does server-side code completion using the clang-autocomplete plugin
 *
 * @copyright 2015, Robin Dietrich
 * @license AGPLv3 <http://www.gnu.org/licenses/agpl.html>
 */

// Server side version of our code completion module
module.exports = function (vfs, options, register) {
    var clang_tool = require("clang_tool");

    // Set this to true during development
    var debug = true;
    var myLog = function(msg) {
        var toLog = "";
        for (var i = 0; i < arguments.length; ++i) {
            if (typeof(arguments[i]) == "object")
                toLog += JSON.stringify(arguments[i]) + " ";
            else
                toLog += arguments[i] + " ";
        }

        if (debug)
            console.log(toLog);
    };

    var clang_obj = null;

    register(null, {
        // Should be called when the server is first invoked, do not call multiple times
        load: function() {
            myLog("[cpp_server load]");
            clang_obj = new clang_tool.object;
        },

        // Sets compiler arguments
        setArgs: function(args) {
            myLog("[cpp_server setArgs]", args);
            clang_obj.setArgs(args);
        },

        // Adds / updates a file on the index
        indexTouch: function(file) {
            myLog("[cpp_server indexTouch]", file);
            clang_obj.indexTouch(file);
        },

        // Add unsaved contents to index
        indexTouchUnsaved: function(file, content) {
            myLog("[cpp_server indexTouchUnsaved]", file);
            clang_obj.indexTouchUnsaved(file, content);
        },

        // Returns memory usage for each file on the index
        indexStatus: function(cb) {
            myLog("[cpp_server indexStatus]");
            cb(false, clang_obj.indexStatus());
        },

        // Clears the index [for a specifc file]
        indexClear: function(file) {
            if (typeof(file) != "undefined") {
                myLog("[cpp_server indexClear]", file);
                clang_obj.indexClear(file);
            } else {
                myLog("[cpp_server indexClear]");
                clang_obj.indexClear();
            }
        },

        // Generates file outline
        fileOutline: function(file, cb) {
            myLog("[cpp_server fileOutline]", file);
            cb(false, clang_obj.fileOutline(file));
        },

        // Returns diagnostic information
        fileDiagnose: function(file, cb) {
            myLog("[cpp_server fileDiagnose]", file);
            cb(false, clang_obj.fileDiagnose(file));
        },

        // Returns potential code completion candidates at a specific location
        cursorCandidatesAt: function(file, row, col, cb) {
            myLog("[cpp_server cursorCandidatesAt]", file, row, col);
            cb(false, clang_obj.cursorCandidatesAt(file, row, col));
        },

        // Returns type under cursor
        cursorTypeAt: function(file, row, col, cb) {
            myLog("[cpp_server cursorTypeAt]", file, row, col);
            cb(false, clang_obj.cursorTypeAt(file, row, col));
        },

        // Returns where the decl under the cursor has been defined
        cursorDefitionAt: function(file, row, col, cb) {
            myLog("[cpp_server cursorDefinitionAt]", file, row, col);
            cb(false, clang_obj.cursorDefitionAt(file, row, col));
        },

        // Returns where the decl under the cursor has been declared
        cursorDeclarationAt: function(file, row, col, cb) {
            myLog("[cpp_server cursorDeclarationAt]", file, row, col);
            cb(false, clang_obj.cursorDeclarationAt(file, row, col));
        },

        // Should be called to clean up the memory of ccomplete
        unload: function() {
            // @todo: investigate if v8 is smart enough to realize no one is holding a reference
            //        to ccomplete anymore. Implement ccomplete.purge() as an alternative.
            clang_obj = null;
        }
    });
};
