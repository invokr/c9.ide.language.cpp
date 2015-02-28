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

    // caches last results
    var last_results = null;
    var last_pos = 0;

    // returns index of last full word
    function get_last_word_start(str) {
        var last = 0;
        for (var i = 0; i < str.length; ++i) {
            if (!str[i].match(/\w/)) {
                last = i+1;
            }
        }
        return last;
    }

    // takes care of initial plugin registration
    completer.init = function(callback) {
        callback();
    };

    // check if we handle the language
    completer.handlesLanguage = function(language) {
        return language === "c_cpp";
    };

    // do an initial parse to speed things up in the future
    completer.onDocumentOpen = function (path, doc, oldPath, callback) {
        completer.sender.emit("documentOpened", {path: path});
        callback();
    };

    // send closing info
    completer.onDocumentClose = function (path, callback) {
        completer.sender.emit("documentClosed", {path: path});
        callback();
    };

    // code completion
    completer.complete = function(doc, fullAst, pos, currentNode, callback) {
        // returns true if one strings is a subsequent match to another
        var filter_match = function (search, text) {
            var idx = 0;

            for (var i = 0; i < text.length; ++i) {
                if (idx == search.length)
                    return true;

                if (text[i] == search[idx])
                    ++idx;
            }

            return false;
        }

        // filter candidates based on entered text
        var filter_results = function (results, txt) {
            // match each results name to the subsequence
            var ret = [];

            if (txt.length)
                _.forEach(results, function(res) {
                    if (filter_match(txt, res.name))
                        ret.push(res);
                });
            else
                ret = results;

            // transform to c9 format
            var retConv = [];
            _.forEach(ret, function(res) {
                var r_meta = res.args.length ? "("+res.args.join(", ")+")" : null;

                retConv.push({
                    name: res.name, meta: r_meta, replaceText: res.name,
                    icon: null, priority: 100, doc: ""
                });
            });

            return retConv;
        };

        // create a unique numeric id to identify correct callback relationships
        var cId = ++uId;

        // match line to last full word
        var line = doc.getLine(pos.row);
        var wIdx = get_last_word_start(line.substr(0, pos.column));

        // pull back completion to the beginning if we have a full word start
        console.log(pos.column, wIdx);
        pos.column = wIdx;
        var wMatch = line.substr(wIdx);

        // check if we can use cached results
        if (last_results && last_pos.row == pos.row && last_pos.column == pos.column) {
            callback(last_results);
            return;
        }

        // cb when code completion is done
        completer.sender.on("completionResult", function tmp(event) {
            if (event.data.id != cId)
                return;

            // unregister this cb
            completer.sender.off("invokeCompletionReturn", tmp);

            last_results = filter_results(event.data.results, wMatch);
            last_pos = pos;

            // send results back
            callback(last_results);
        });

        // send completion data to the server
        completer.sender.emit("completion", {
            pos: pos,
            id: cId
        });
    };

    // do some code completion magic
    /*completer.complete = function(doc, fullAst, pos, currentNode, callback) {
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

            // match line to last full word
            var wIdx = get_last_word_start(line.substr(0, pos.column));
            var wMatch = false;

            if (wIdx < line.length) {
                // last index is within boundaries
                wMatch = line.substr(wIdx);
            }

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
                        r_icon = "package";
                        break;

                    // a single function, almost always emitted
                    case "function":
                        r_name = result.name + "(" + result.params.join(", ") + ")";
                        r_doc = result.return + " <strong>" + result.name + "</strong>(" + result.params.join(", ") + ")"
                        r_replace = result.name + "(";
                        r_icon = "method";
                        //r_meta = "(" + result.params.join(", ") + ")";
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
                        //r_priority = 1004;
                        r_name = result.name;
                        r_replace = result.name;
                        break;

                    // class method
                    case "method":
                        r_name = result.name + "(" + result.params.join(", ") + ")";
                        r_doc = result.return + " <strong>" + result.name + "</strong>(" + result.params.join(", ") + ")"
                        r_replace = result.name + "(";
                        r_icon = "method";
                        //r_meta = "(" + result.params.join(", ") + ")";
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
                        break;
                }

                if (!wMatch || r_name.substr(0, wMatch.length) == wMatch) {
                    // add result to list
                    results.push({
                        name: r_name, meta: r_meta, replaceText: r_replace,
                        icon: r_icon, priority: r_priority, doc: r_doc
                    });
                }
            });

            callback(results);
        });


        // send the completion data to the server
        completer.sender.emit("invokeCompletion", {
            pos: pos,
            id: cId
        });
    };*/
});
