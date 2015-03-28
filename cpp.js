/**
 * @copyright 2015, Robin Dietrich
 * @license AGPLv3 <http://www.gnu.org/licenses/agpl.html>
 */
define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "language", "ext", "tabManager", "c9", "save",
        "settings", "preferences", "ui", "collab", "collab.connect",
        "error_handler", "dialog.error"
    ];
    main.provides = ["cpp"];
    return main;

    // returns true if file is handled by us (by extension)
    function is_c_cpp(filename) {
        // handled extensions, last used by capnproto ('-.-)
        var _extensions = ["c", "h", "cc", "cpp", "hpp", "cxx", "hxx", "h++", "c++"];

        // get extension
        var _extension = filename.split(".");
        if (_extension.length < 2)
            return false;

        _extension = _extension[_extension.length - 1];
        return (_extensions.indexOf(_extension) >= 0);
    }

    function main(options, imports, register) {
        // imports
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
        var ui = imports.ui;
        var collab = imports.collab;
        var collabConnect = imports["collab.connect"];
        var errorHandler = imports.error_handler;
        var showError = imports["dialog.error"].show;

        // constants and services used in the plugin
        var basedir = c9.workspaceDir;  // Use this to get the full file path for clang_tool
        var clang_tool = null;          // Service side clang_tool component
        var worker = null;              // Language worker

        // Callback when a new document is opened
        //  - Adds new files to the index to enable faster completion
        function onDocumentOpened(event) {
            if (!is_c_cpp(event.data.path))
                return;

            if (clang_tool)
                clang_tool.indexTouch(basedir+event.data.path);
        }

        // Callback when a document is closed
        //  - Removed translation unit from the index
        function onDocumentClosed(event) {
            if (!is_c_cpp(event.data.path))
                return;

            if (clang_tool)
                clang_tool.indexClear(basedir+event.data.path);
        }

        // Callback when a document is saved
        function onDocumentSave(event) {
            if (!is_c_cpp(event.path))
                return;

            // add / update on index
            if (clang_tool)
                clang_tool.indexTouch(basedir+event.path);
        }

        // Code completion
        function workerCompletion(event) {
            var value = tabManager.focussedTab.document.value;
            var path = basedir+tabManager.focussedTab.path;

            if (!clang_tool)
                return worker.emit("_completionResult", {data: {id: event.data.id, results: []}});

            // add temporary data to index and do code completion
            clang_tool.indexTouchUnsaved(path, value, function () {
                clang_tool.cursorCandidatesAt(path, event.data.pos.row+1, event.data.pos.column+1, function(err, res) {
                    worker.emit("_completionResult", {data: {id: event.data.id, results: res}});
                });
            });
        }

        // Code diagnosics
        function workerAnalysis(event) {
            var value = tabManager.focussedTab.document.value;
            var path = basedir+tabManager.focussedTab.path;

            if (!clang_tool)
                return worker.emit("_diagnoseResult", {data: {id: event.data.id, results: []}});

            clang_tool.fileDiagnose(path, function(err, res) {
                res = _.filter(res, function(r) {
                    return r.file == path;
                });

                worker.emit("_diagnoseResult", {data: {id: event.data.id, results: res, path: path}});
            });
        }

        // AST to outline conversion
        function workerOutline(event) {
            var path = basedir+tabManager.focussedTab.path;

            if (!clang_tool)
                return worker.emit("_outlineResult", {data: {id: event.data.id, ast: []}});

            // generate outline
            clang_tool.fileAst(path, function(err, res) {
                worker.emit("_outlineResult", {data: {id: event.data.id, ast: res.children}});
            });
        }

        // Register our language handler
        var path = options.packagePath;
        path = path.substr(0, path.lastIndexOf("/") + 1) + "cpp_worker";

        language.registerLanguageHandler(path, function(err, worker_) {
            if (err) {
                errorHandler.reportError(err);
                return showError("Could not load cpp language worker: " + (err.message | err));
            }

            // Set worker object and register callback's
            worker = worker_;
            worker.on("documentOpened", onDocumentOpened);
            worker.on("documentClosed", onDocumentClosed);
            save.on("afterSave", onDocumentSave);

            //
            // Important:
            // Do not run indexTouch or indexTouchUnsaved for each and every worker action.
            // Certain actions may be interleaved, creating a indexTouch <-> indexTouchUnsaved chain
            // that takes forever to resolve.
            //
            // + Call indexTouchUnsaved in all worker functions that handle temp data
            // + Call indexTouch only on save events
            //

            worker.on("_completion", workerCompletion);
            worker.on("_diagnose", workerAnalysis);
            worker.on("_outline", workerOutline);
        });

        // Called on c9.connect
        function onOnline() {
            ext.loadRemotePlugin("clang_tool", {
                code: require("text!./cpp_server.js"),
                redefine: !clang_tool
            }, function(err, plugin) {
                if (err) {
                    errorHandler.reportError(err);
                    return showError("[c9.ide.language.cpp] Error initializing server: " + (err.message | err));
                }

                // connect clang
                clang_tool = plugin;
                clang_tool.load(function (err) {
                    if (err) {
                        errorHandler.reportError(err);
                        return showError("[c9.ide.language.cpp] Unable to load clang_tool: " + (err.message | err));
                    }

                    clang_tool.setArgs(settings.get("project/c_cpp/@compilerArguments").split("\n"));
                });
            });
        }

        // Called on c9.disconnect
        function onOffline() {
            if (clang_tool) {
                clang_tool.indexClear(function() {
                    clang_tool = null;
                });
            }
        }

        c9.on("connect", onOnline);
        c9.on("disconnect", onOffline);

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
        //  - Allow different cpp extensions to be added
        //  - Cache handling with indexStatus and indexClear
        //  - Recursive file ast parsing for tokenizers
        plugin.freezePublicAPI({});

        // Registers our plugin with C9
        register(null, { cpp: plugin });
    }
});
