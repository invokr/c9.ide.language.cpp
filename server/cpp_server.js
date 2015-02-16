/**
 * Does server-side code completion using the clang-autocomplete plugin
 *
 * @copyright 2015, Robin Dietrich
 * @license AGPLv3 <http://www.gnu.org/licenses/agpl.html>
 */

var clang_autocomplete = require("clang-autocomplete");
var ccomplete = null;
var fs = require("fs");

// Server side version of our code completion module
module.exports = function (vfs, options, register) {
    register(null, {
        // Should be called when the server is first invoked, do not call multiple times
        load: function() {
            // register the completion library
            ccomplete = new clang_autocomplete.lib();
        },

        // Tries to complete the code at the given file position
        complete: function(path, value, row, col, callback) {
            // temp file needs to be in the same path so that includes actually work
            var tmp_path = path.substr(0, path.lastIndexOf("/")+1) + ".tmpcmpl_" + path.substr(path.lastIndexOf("/")+1);

            // write, call, delete
            fs.writeFileSync(tmp_path, value);
            var results = ccomplete.Complete(tmp_path, row, col);
            fs.unlinkSync(tmp_path);

            // run callback
            callback(0, results);
        },

        // Returns anything that clang's diagnostic feature emits
        diagnose: function(path, value, callback) {
            // temp file needs to be in the same path so that includes actually work
            var tmp_path = path.substr(0, path.lastIndexOf("/")+1) + ".tmpdiag_" + path.substr(path.lastIndexOf("/")+1);

            // write, call, delete
            fs.writeFileSync(tmp_path, value);
            var results = ccomplete.Diagnose(path);
            fs.unlinkSync(tmp_path);

            // run callback
            callback(0, results);
        },

        // Sets clang compiler arguments
        set_args: function(args) {
            ccomplete.arguments = args;
        },

        // Returns the current compiler arguments
        get_args: function(args, callback) {
            callback(0, ccomplete.arguments);
        },

        // Set cache timeout
        set_expiration: function(args) {
            ccomplete.expiration = parseInt(args);
        },

        // Should be called to clean up the memory of ccomplete
        unload: function() {
            // @todo: investigate if v8 is smart enough to realize no one is holding a reference
            //        to ccomplete anymore. Implement ccomplete.purge() as an alternative.
            ccomplete = null;
        }
    });
};