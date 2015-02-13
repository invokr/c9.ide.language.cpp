/**
 * @copyright 2015, Robin Dietrich
 * @license AGPLv3 <http://www.gnu.org/licenses/agpl.html>
 */
define(function(require, exports, module) {
    var completeUtil = require("plugins/c9.ide.language/complete_util");
    var baseLanguageHandler = require('plugins/c9.ide.language/base_handler');
    var worker_util = require("plugins/c9.ide.language/worker_util");
    var _ = require("plugins/c9.nodeapi/lodash");

    var completer = module.exports = Object.create(baseLanguageHandler);
    var uId = 0;

    // takes care of initial plugin registration
    completer.init = function(callback) {
        callback();
    };

    // check if we handle the language
    completer.handlesLanguage = function(language) {
        if (language === "c_cpp")
            console.log("Handeling language");
        return language === "c_cpp";
    };

    // do an initial parse to speed things up in the future
    console.onDocumentOpen = function (path, doc, oldPath, callback) {
        callback();
    };

    // do some code completion magic
    completer.complete = function(doc, fullAst, pos, currentNode, callback) {
        // create a unique numeric id to identify correct callback relationships
        var cId = ++uId;

        // wait for the result and invoke the complete.callback function
        console.log("[cpp worker] Waiting for completion");
        completer.sender.on("invokeCompletionReturn", function invoTmp(ev) {
            console.log("[cpp] Received completion results", cId, ev);
            if (ev.data.id != cId)
                return;

            // unregister this cb
            completer.sender.off("invokeCompletionReturn", invoTmp);

            // get the results going
            var results = [];
            _.forEach(ev.data.results, function (res) {
                var name = res.function[0];
                res.function.splice(0, 1);

                results.push({
                    name: name,
                    meta: res.return,
                    replaceText: name,
                    icon: null,
                    priority: 999,
                    doc: res.return + " " + name + "(" + res.function.join(", ") + ")"
                });
            });

            console.log("[cpp] Providing callback");
            callback(results);
        });


        // send the completion data to the server
        console.log("[cpp worker] Sending request");
        completer.sender.emit("invokeCompletion", {
            pos: pos,
            id: cId
        });
    };
});