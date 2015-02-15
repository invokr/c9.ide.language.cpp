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
        completer.sender.on("invokeCompletionReturn", function invoTmp(ev) {
            if (ev.data.id != cId)
                return;

            // unregister this cb
            completer.sender.off("invokeCompletionReturn", invoTmp);

            var results = []; // results to return
            var line = doc.getLine(pos.row); // active line

            _.forEach(ev.data.results, function(result) {
                // variables used in the result
                var r_name, r_meta, r_replace, r_doc = "";
                var r_icon = null;
                var r_priority = 1005;

                switch(result.type) {
                    // struct, class, union, enum, enum member
                    case "enum_member":
                    case "def":
                        r_name = result.name;
                        r_doc = result.description;
                        r_replace = result.name;
                        r_priority = 1004;
                        r_icon = "package";
                        break;

                    // a single function, almost always emitted
                    case "function":
                        r_name = result.name;
                        r_doc = result.return + " <strong>" + result.name + "</strong>(" + result.params.join(", ") + ")"
                        r_replace = result.name + "(";
                        r_priority = 1001;
                        r_icon = "method";
                        break;

                    // variable
                    case "variable":
                        r_name = result.name;
                        r_doc = result.return + " " + result.name;
                        r_replace = result.name;
                        r_icon = "property";
                        break;

                    // type definition
                    case "typedef":
                        r_priority = 1004;
                        r_name = result.name;
                        r_meta = "typedef";
                        r_replace = result.name;
                        break;

                    // class method
                    case "method":
                        r_name = result.name;
                        r_doc = result.return + " <strong>" + result.name + "</strong>(" + result.params.join(", ") + ")"
                        r_replace = result.name + "(";
                        r_icon = "method";
                        break;

                    // class attribute
                    case "member":
                        r_name = result.name;
                        r_doc = result.return + " " + result.name;
                        r_replace = result.name;
                        r_icon = "property";
                        break;

                    // namespace
                    case "namespace":
                        r_name = result.name;
                        r_meta = "namespace";
                        r_replace = result.name + "::";
                        break;

                    // constructor
                    case "constructor":
                        r_name = result.name + "(" + result.params.join(", ") + ")";
                        r_doc = result.return + " <strong>" + result.name + "</strong>(" + result.params.join(", ") + ")"
                        r_replace = result.name;
                        r_icon = "package";
                        break;

                    // current argument in function
                    case "current":
                        r_priority = 1010;
                        r_name = result.name;
                        r_replace = result.name;
                        r_meta = "param";
                        break;
                }

                // add result to list
                results.push({
                    name: r_name, meta: r_meta, replaceText: r_replace,
                    icon: r_icon, priority: r_priority, doc: r_doc
                })
            });

            callback(results);
        });


        // send the completion data to the server
        completer.sender.emit("invokeCompletion", {
            pos: pos,
            id: cId
        });
    };
});