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

    function main(options, imports, register) {
        var _ = require("lodash");
        var language = imports.language;
        var ext = imports.ext;
        var Plugin = imports.Plugin;
        var plugin = new Plugin("Robin Dietrich", main.consumes);
        var tabManager = imports.tabManager;
        var save = imports.save;
        var settings = imports.settings;
        var prefs = imports.preferences;
        var fs = imports.fs;

        // Use this to get the full file path for clang-autocomplete
        var basedir = imports.c9.workspaceDir;

        // Worker / Server components
        var server = null;
        var worker_cc = null;
        var worker_diag = null;

        // Registeres our language handlers
        language.registerLanguageHandler('plugins/c9.ide.language.cpp/worker/codecompletion_worker', function(err, worker_) {
            if (err) console.log(err);

            // Set worker object and register callback's
            worker_cc = worker_;
            worker_cc.on("invokeCompletion", ccomplete);
        });

        language.registerLanguageHandler('plugins/c9.ide.language.cpp/worker/diagnose_worker', function(err, worker_) {
            if (err)
                console.log(err);

            // Set worker object and register callback's
            worker_diag = worker_;
            worker_diag.on("invokeDiagnose", diagnose);
        });

        // Initialized the server side handler
        plugin.on("load", function() {
            // Load our server side plugin
            ext.loadRemotePlugin("codecompletion_server", {
                code: require("text!./server/cpp_server.js"),
                extendToken: false,
                redefine: !server
            }, function(err, server_) {
                if (err)
                    console.log(err);

                server = server_;
                server.load();
                server.set_args(settings.get("project/c_cpp/@compilerArguments").split("\n"));
                server.set_expiration(settings.get("project/c_cpp/@cacheTimeout"));
            });

            // Read settings
            settings.on("read", function(e) {
                // project specific settings
                settings.setDefaults("project/c_cpp/", [
                    ["compilerArguments", "-I/usr/include\n-I/usr/local/include"]
                ]);

                // user settings
                settings.setDefaults("user/c_cpp/", [
                    ["cacheTimeout", "30"],
                    ["clear", "true"]
                ]);
            }, plugin);

            // Listen to updates
            settings.on("project/c_cpp/@compilerArguments", function(value){
                server.set_args(value.split("\n"));
            }, plugin);

            settings.on("project/c_cpp/@cacheTimeout", function(value){
                server.set_expiration(value);
            }, plugin);

            // Project specific preferences
            prefs.add({
                "Project" : {
                    "C / C++" : {
                        position: 1000,
                        "Compiler Arguments" : {
                           type: "textarea",
                           width: 150,
                           height: 130,
                           rowheight: 155,
                           path: "project/c_cpp/@compilerArguments",
                           position: 5000
                        }
                    }
                }
            }, plugin);

            // User specific preferences
            prefs.add({
                "Language" : {
                    position: 500,
                    "C / C++" : {
                        position: 100,
                        "Cache Expiration Time" : {
                            type: "spinner",
                            path: "user/c_cpp/@cacheTimeout",
                            position: 6000,
                            min: "1",
                            max: "120"
                        }
                    }
                }
            }, plugin);
        });

        // Make sure the plugin is unloaded so that cached translation units get purged
        plugin.on("unload", function(){
            if (server) {
                server.unload();
                server = null;
                worker_cc = null;
                worker_diag = null;
            }
        });

        // Public api for the cpp plugin
        plugin.freezePublicAPI({
            // Returns code completion results
            complete: function(path, row, col, callback) {
                if (server) {
                    server.complete(path, row, col, callback);
                } else {
                    callback("Server not initialized yet.");
                }
            },

            // Returns clang's diagnostic information
            diagnose: function(path, callback) {
                if (server) {
                    server.diagnose(path, callback);
                } else {
                    callback("Server not initialized yet.");
                }
            }
        });

        // Calls the code completion function
        function ccomplete(ev) {
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
        }

        // Registers our plugin with C9
        register(null, { cpp: plugin });
    }
});
