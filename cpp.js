/**
 * @copyright 2015, Robin Dietrich
 * @license AGPLv3 <http://www.gnu.org/licenses/agpl.html>
 */
define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "language", "ext", "tabManager", "c9", "save",
        "settings", "preferences", "fs"
    ];
    main.provides = ["cpp"];

    return main;

    // returns true if file is handled by us (by extension)
    function is_c_cpp(filename) {
        // handled extensions
        var _extensions = ["c", "h", "cc", "cpp", "hpp", "cxx", "hxx"];

        // get extension
        var _extension = filename.split(".");
        if (_extension.length < 2)
            return false;

        _extension = _extension[_extension.length - 1];
        return (_extensions.indexOf(_extension) >= 0);
    }

    function main(options, imports, register) {
        var _ = require("lodash");
        var language = imports.language;
        var ext = imports.ext;
        var Plugin = imports.Plugin;
        var plugin = new Plugin("Robin Dietrich", main.consumes);
        var tabManager = imports.tabManager;
        var c9 = imports.c9;
        var save = imports.save;
        var settings = imports.settings;
        var prefs = imports.preferences;
        var fs = imports.fs;

        // Use this to get the full file path for clang-autocomplete
        var basedir = c9.workspaceDir;

        // External clang_tool component
        var clang_tool = null;

        function loadClangTool() {
            ext.loadRemotePlugin("clang_tool", {
                code: require("text!./server/cpp_server.js"),
                redefine: !clang_tool
            }, function(err, plugin) {
                if (err) {
                    alert("[c9.ide.language.cpp] Error initializing server: ", err);
                    return;
                }

                clang_tool = plugin;
                clang_tool.load();
                clang_tool.setArgs(settings.get("project/c_cpp/@compilerArguments").split("\n"));
            });
        }

        c9.on("connect", loadClangTool);
        c9.on("disconnect", function() {
            clang_tool = null;
        });

        // Register our language handlers
        var worker_cc = null;

        language.registerLanguageHandler('plugins/c9.ide.language.cpp/worker/codecompletion_worker', function(err, worker_) {
            if (err) {
                alert("[[c9.ide.language.cpp] Error initializing worker: ", err);
                return;
            }

            // Set worker object and register callback's
            worker_cc = worker_;

            // Put each document that is opened and handled on the index
            worker_cc.on("documentOpened", function(event) {
                if (is_c_cpp(event.data.path))
                    clang_tool.indexTouch(basedir+event.data.path);
            });

            // Automatically free memory of closed objects
            worker_cc.on("documentClosed", function(event) {
                if (is_c_cpp(event.data.path))
                    clang_tool.indexClear(basedir+event.data.path);
            });
        });

        /*language.registerLanguageHandler('plugins/c9.ide.language.cpp/worker/diagnose_worker', function(err, worker_) {
            if (err)
                console.log(err);

            // Set worker object and register callback's
            worker_diag = worker_;
            worker_diag.on("invokeDiagnose", diagnose);
        });*/

        // Initialize the plugin
        plugin.on("load", function() {
            // Add project specific preferences
            prefs.add({
                "Project" : {
                    "C / C++" : {
                        position: 1000,
                        "Compiler Arguments" : {
                           type: "textarea",
                           width: 200,
                           height: 130,
                           rowheight: 155,
                           path: "project/c_cpp/@compilerArguments",
                           position: 5000
                        }
                    }
                }
            }, plugin);

            // Set default values
            settings.on("read", function(e) {
                settings.setDefaults("project/c_cpp", [
                    ["compilerArguments", "-I/usr/include\n-I/usr/local/include"]
                ]);
            }, plugin);

            // Listen to updates
            settings.on("project/c_cpp/@compilerArguments", function(value) {
                if (clang_tool)
                    clang_tool.setArgs(value.split("\n"));
            }, plugin);
        });

        // Make sure the plugin is unloaded correctly so that cached translation units get purged
        plugin.on("unload", function(){
            if (clang_tool) {
                clang_tool.unload();
                clang_tool = null;
                worker_cc = null;
            }
        });

        // Public api for the cpp plugin
        plugin.freezePublicAPI({});

        // Calls the code completion function
        /*function ccomplete(ev) {
            // get value and original path
            var value = tabManager.focussedTab.document.value;
            var path = basedir+tabManager.focussedTab.path;

            // do completion on the new file
            server.complete(path, value, ev.data.pos.row+1, ev.data.pos.column+1, function(err, results) {
                worker_cc.emit("invokeCompletionReturn", {
                    data: { id: ev.data.id, results: results }
                });
            });
        }

        // Calls the diagnose function
        function diagnose(ev) {
            // get value and original path
            var value = tabManager.focussedTab.document.value;
            var path = basedir+tabManager.focussedTab.path;

            server.diagnose(path, value, function(err, results) {
                worker_diag.emit("diagnoseReturn", {
                    data: { id: ev.data.id, results: results, path: path }
                });
            });
        }*/

        // Registers our plugin with C9
        register(null, { cpp: plugin });
    }
});
