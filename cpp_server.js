/**
 * Does server-side code completion using the clang-autocomplete plugin
 *
 * @copyright 2015, Robin Dietrich
 * @license MIT
 */

// Server side version of our code completion module
module.exports = function (vfs, options, register) {
    var clang_tool = require("clang_tool");
    var clang_obj = null;
    var clang_cache = {};
    var collabServer = null;

    // Debugging
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

    // Collab
    vfs.use("collab", {}, function(err, collab) {
        if (err) {
            myLog("[cpp_server collab] Unavailable");
            collabServer = null;
            return null;
        }

        myLog("[cpp_server collab] Connected");
        collabServer = collab.api;
    });

    /** Ensure we have clang_obj */
    var ensure = function() {
        if (!clang_obj) {
            myLog("[cpp_server ensure]");
            clang_obj = new clang_tool.object;
        }
    };

    /** Return document contents from collab server */
    var getCollabDoc = function(path, rev, cb) {
        if (!collabServer)
            return cb("No collab server found and cannot use local value");

        // Make sure we get our document
        var timeout = setTimeout(function() {
            cb("Unable to get document from collab: Timeout.");
        }, 15000);

        var docId = path.replace(/^\//, "");
        collabServer.getDocument(docId, function (err, data) {
            clearTimeout(timeout);

            // Collabg error
            if (err) return cb(err);
            if (!data || !data.contents) return cb("Unable to get document from collab: Unkown.");

            // We got our version
            if (rev <= data.dataValues.revNum) return cb(false, data.dataValues.contents);

            // We need to wait for it to be saved
            collabServer.emitter.on("afterEditUpdate", function wait(e) {
                if (e.docId !== docId || e.doc.revNum < rev)
                    return;

                collabServer.emitter.removeListener("afterEditUpdate", wait);
                cb(null, e.doc.contents);
            });
        });
    };

    register(null, {
        // Should be called when the server is first invoked, do not call multiple times
        load: function(cb) {
            myLog("[cpp_server load]");

            // connect clang
            ensure();
            cb(false);
        },

        // Sets compiler arguments
        setArgs: function(args, cb) {
            myLog("[cpp_server setArgs]", args);
            ensure();
            clang_obj.setArgs(args);

            if (cb)
                cb(false);
        },

        // Adds / updates a file on the index
        indexTouch: function(file, cb) {
            myLog("[cpp_server indexTouch]", file);
            ensure();
            clang_obj.indexTouch(file);

            // cache diagnosis and ast for the file in the cache
            clang_cache[file] = {
                diag: clang_obj.fileDiagnose(file),
                ast: clang_obj.fileAst(file)
            };

            if (cb)
                cb(false);
        },

        // Add unsaved contents to index
        indexTouchUnsaved: function(file, content, cb) {
            myLog("[cpp_server indexTouchUnsaved]", file);
            ensure();
            clang_obj.indexTouchUnsaved(file, content);

            if (cb)
                cb(false);
        },

        // Add unsaved contents to index using collab
        indexTouchUnsavedCollab: function(file, file_collab, rev, cb) {
            myLog("[cpp_server indexTouchUnsavedCollab]", file, file_collab, rev);
            ensure();

            // get data from collab
            getCollabDoc(file_collab, rev, function(err, data) {
                if (err) {
                    myLog("[cpp_server indexTouchUnsavedCollab]", err);
                    return cb(err);
                }

                clang_obj.indexTouchUnsaved(file, data);
                if (cb) cb(false);
            });
        },

        // Returns memory usage for each file on the index
        indexStatus: function(cb) {
            myLog("[cpp_server indexStatus]", clang_obj);
            ensure();
            cb(false, clang_obj.indexStatus());
        },

        // Clears the index [for a specifc file]
        indexClear: function(file, cb) {
            ensure();
            if (typeof(file) != "undefined") {
                myLog("[cpp_server indexClear]", file);
                clang_obj.indexClear(file);

                if (typeof(clang_cache[file]) != "undefined")
                    delete clang_cache[file];
            } else {
                myLog("[cpp_server indexClear]");
                clang_obj.indexClear();
                clang_cache = {};
            }

            if (cb)
                cb(false);
        },

        // Generates file outline
        fileOutline: function(file, cb) {
            myLog("[cpp_server fileOutline]", file);
            ensure();
            cb(false, clang_obj.fileOutline(file));
        },

        // Returns diagnostic information
        fileDiagnose: function(file, cb) {
            myLog("[cpp_server fileDiagnose]", file);
            ensure();

            if (typeof(clang_cache[file]) != "undefined")
                cb(false, clang_cache[file].diag);
            else
                cb(false, []);
        },

        // Returns ast
        fileAst: function(file, cb) {
            myLog("[cpp_server fileAst]", file);
            ensure();

            if (typeof(clang_cache[file]) != "undefined")
                cb(false, clang_cache[file].ast);
            else
                cb(false, {});
        },

        // Returns potential code completion candidates at a specific location
        cursorCandidatesAt: function(file, row, col, cb) {
            myLog("[cpp_server cursorCandidatesAt]", file, row, col);
            ensure();
            cb(false, clang_obj.cursorCandidatesAt(file, row, col));
        },

        // Returns type under cursor
        cursorTypeAt: function(file, row, col, cb) {
            myLog("[cpp_server cursorTypeAt]", file, row, col);
            ensure();
            cb(false, clang_obj.cursorTypeAt(file, row, col));
        },

        // Returns where the decl under the cursor has been defined
        cursorDefinitionAt: function(file, row, col, cb) {
            myLog("[cpp_server cursorDefinitionAt]", file, row, col);
            ensure();
            cb(false, clang_obj.cursorDefinitionAt(file, row, col));
        },

        // Returns where the decl under the cursor has been declared
        cursorDeclarationAt: function(file, row, col, cb) {
            myLog("[cpp_server cursorDeclarationAt]", file, row, col);
            ensure();
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
