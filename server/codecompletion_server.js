/**
 * Does server-side code completion using the clang-autocomplete plugin
 *
 * @copyright 2015, Robin Dietrich
 * @license AGPLv3 <http://www.gnu.org/licenses/agpl.html>
 */

var clang_autocomplete = require("clang-autocomplete");
var ccomplete = null;

// Server side version of our code completion module
module.exports = function (vfs, options, register) {
    register(null, {
        // Should be called when the server is first invoked, do not call multiple times
        load: function() {
            // register the completion library
            console.log("[cpp] Server loaded");
            ccomplete = new clang_autocomplete.lib();
            ccomplete.arguments = new Array("-std=c++0x", "-I/usr/include", "-I/usr/local/include");
        },

        // Tries to complete the code at the given file position
        complete: function(path, row, col, callback) {
            console.log("[cpp] Code complete called");
            var results = ccomplete.Complete(path, row, col);
            callback(0, results);
        },

        // Returns anything that clang's diagnostic feature emits
        diagnose: function(path, callback) {
            console.log("[cpp] Diagnose called");
            callback(0, ccomplete.Diagnose(path));
        },

        // Should be called to clean up the memory of ccomplete
        unload: function() {
            // @todo: investigate if v8 is smart enough to realize no one is holding a reference
            //        to ccomplete anymore. Implement ccomplete.purge() as an alternative.
            ccomplete = null;
        }
    });
};