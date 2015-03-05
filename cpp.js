/**
 * @copyright 2015, Robin Dietrich
 * @license AGPLv3 <http://www.gnu.org/licenses/agpl.html>
 */
define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "language", "ext", "tabManager", "c9", "save",
        "settings", "preferences", "fs", "ui"
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
        var ui = imports.ui;


        // Use this to get the full file path for clang-autocomplete
        var basedir = c9.workspaceDir;

        // External clang_tool component
        var clang_tool = null;

        function loadClangTool() {
            ext.loadRemotePlugin("clang_tool", {
                code: require("text!./cpp_server.js"),
                redefine: !clang_tool
            }, function(err, plugin) {
                if (err) {
                    alert("[c9.ide.language.cpp] Error initializing server: ", err);
                    return;
                }

                clang_tool = plugin;
                clang_tool.load(function (err) {
                    clang_tool.setArgs(settings.get("project/c_cpp/@compilerArguments").split("\n"));
                });
            });
        }

        c9.on("connect", loadClangTool);
        c9.on("disconnect", function() {
            if (clang_tool) {
                clang_tool.indexClear(function() {
                    clang_tool = null;
                });
            }
        });

        // Register our language handler
        var worker = null;

        language.registerLanguageHandler('plugins/c9.ide.language.cpp/cpp_worker', function(err, worker_) {
            if (err) {
                alert("[[c9.ide.language.cpp] Error initializing worker: ", err);
                return;
            }

            // Set worker object and register callback's
            worker = worker_;

            // Put each document that is opened and handled on the index
            worker.on("documentOpened", function(event) {
                if (!is_c_cpp(event.data.path))
                    return;

                // add to index
                clang_tool.indexTouch(basedir+event.data.path);
            });

            // Listen fo file saves and add on-disk content to the index
            // This might trigger when documentClosed is emitted and do one
            // additional parse before indexClear is called.
            save.on("afterSave", function(ev) {
                if (!is_c_cpp(ev.path))
                    return;

                // add / update on index
                if (clang_tool)
                    clang_tool.indexTouch(basedir+ev.path);
            });

            // Automatically free memory of closed objects
            worker.on("documentClosed", function(event) {
                if (!is_c_cpp(event.data.path))
                    return;

                clang_tool.indexClear(basedir+event.data.path);
            });

            //
            // Important:
            // Do not run indexTouch or indexTouchUnsaved for each and every worker action.
            // Certain actions may be interleaved, creating a indexTouch <-> indexTouchUnsaved chain
            // that takes forever to resolve.
            //
            // + Call indexTouchUnsaved in all worker functions that handle temp data
            // + Call indexTouch only on save events
            //

            // Handle code completion
            worker.on("_completion", function(event) {
                var value = tabManager.focussedTab.document.value;
                var path = basedir+tabManager.focussedTab.path;

                // add temporary data to index and do code completion
                clang_tool.indexTouchUnsaved(path, value, function () {
                    clang_tool.cursorCandidatesAt(path, event.data.pos.row+1, event.data.pos.column+1, function(err, res) {
                        worker.emit("_completionResult", {data: {id: event.data.id, results: res}});
                    });
                });
            });

            // Handle diagnostics
            worker.on("_diagnose", function(event) {
                var value = tabManager.focussedTab.document.value;
                var path = basedir+tabManager.focussedTab.path;

                clang_tool.fileDiagnose(path, function(err, res) {
                    res = _.filter(res, function(r) {
                        return r.file == path;
                    });

                    worker.emit("_diagnoseResult", {data: {id: event.data.id, results: res, path: path}});
                });
            });

            // Handle outline
            worker.on("_outline", function(event) {
                var path = basedir+tabManager.focussedTab.path;

                if (!is_c_cpp(path)) // Outline is called independet of handlesLanguage
                    return;

                // generate outline
                clang_tool.fileAst(path, function(err, res) {
                    worker.emit("_outlineResult", {data: {id: event.data.id, ast: res.children}});
                });
            });
        });

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

            // Add css
            ui.insertCss(require("text!./icons.css"), false, plugin);
        });

        // Make sure the plugin is unloaded correctly so that cached translation units get purged
        plugin.on("unload", function(){
            if (clang_tool) {
                clang_tool.unload();
                clang_tool = null;
                worker = null;
            }
        });

        // Public api for the cpp plugin
        plugin.freezePublicAPI({});

        // Registers our plugin with C9
        register(null, { cpp: plugin });
    }
});
