/**
 * @copyright 2015, Robin Dietrich
 * @license AGPLv3 <http://www.gnu.org/licenses/agpl.html>
 */
define(function(require, exports, module) {
    main.consumes = ["Plugin", "language", "ext", "tabManager", "c9", "save"];
    main.provides = ["cpp"];

    var _ = require("lodash");

    return main;

    function main(options, imports, register) {
        var language = imports.language;
        var ext = imports.ext;
        var Plugin = imports.Plugin;
        var plugin = new Plugin("Robin Dietrich", main.consumes);
        var tabManager = imports.tabManager;
        var save = imports.save;

        // Use this to get the full file path for clang-autocomplete
        var basedir = imports.c9.workspaceDir;

        // Worker / Server components
        var server = null;
        var worker = null;

        // Registeres our language handler
        language.registerLanguageHandler('plugins/c9.ide.language.cpp/worker/codecompletion_worker',
            function(err, worker_) {
                if (err) console.log(err);

                // Set worker object and register callback's
                worker = worker_;
                worker.on("invokeCompletion", ccomplete);
                console.log("[cpp] Worker registered");
            }
        );

        // Initialized the server side handler
        plugin.on("load", function() {
            console.log("[cpp] Loading plugin");

            // Load our server side plugin
            ext.loadRemotePlugin("codecompletion_server", {
                code: require("text!./server/codecompletion_server.js"),
                extendToken: false,
                redefine: !server
            }, function(err, server_) {
                if (err)
                    console.log(err);

                console.log("[cpp] Server registered");
                server = server_;
                server.load();
            });
        });

        // Make sure the plugin is unloaded so that cached translation units get purged
        plugin.on("unload", function(){
            if (server) {
                server.unload();
                server = null;
                worker = null;
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
            var path = basedir+tabManager.focussedTab.path;

            console.log("sending request", path, ev);
            console.log(server);

            save.save(tabManager.focussedTab, {}, function(err) {
                server.complete(path, ev.data.pos.row+1, ev.data.pos.column+1, function(err, results) {
                    console.log("[cpp] Sending back result", ev);
                    worker.emit("invokeCompletionReturn", {
                        data: { id: ev.data.id, results: results }
                    });

                    var res2 = [];
                    _.forEach(results, function (res) {
                        var name = res.function[0];
                        res.function.splice(0, 1);

                        res2.push({
                            name: name,
                            meta: res.return,
                            replaceText: name,
                            icon: null,
                            priority: 999,
                            doc: res.return + " " + name + "(" + res.function.join(", ") + ")"
                        });
                    });

                    console.log("lodash: ", res2);
                });
            });
        }

        // Registers our plugin with C9
        register(null, { cpp: plugin });
    }
});
