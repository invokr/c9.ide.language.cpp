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

    // different completion types
    var completion_type = {
        namespace_t: 0,
        class_t: 1,
        attribute_t: 2,
        method_t: 3,
        parameter_t: 4,
        struct_t: 5,
        function_t: 6,
        enum_t: 7,
        enum_static_t: 8,
        union_t: 9,
        typedef_t: 10,
        variable_t: 11,
        macro_t: 12,
        unkown_t: 13,
    };

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

            if (search == text)
                return true;

            if (text.substr(0, search.length) == search)
                return true;

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

                var r_icon = null;
                var r_priority = 100;
                switch (res.type) {
                    case completion_type.function_t:
                    case completion_type.method_t:
                        r_icon = "method";
                        break;
                    case completion_type.class_t:
                    case completion_type.struct_t:
                    case completion_type.union_t:
                        r_icon = "package";
                        break;
                    case completion_type.parameter_t:
                        r_priority = 200; // current parameter in the function call
                    case completion_type.attribute_t:
                        r_icon = "attribute";
                        break;
                    default:
                        break;
                }

                retConv.push({
                    name: res.name, meta: r_meta, replaceText: res.name,
                    icon: r_icon, priority: r_priority, doc: null
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
        pos.column = wIdx;
        var wMatch = line.substr(wIdx);

        // check if we can use cached results
        if (last_results && last_pos.row == pos.row && last_pos.column == pos.column) {
            callback(filter_results(last_results, wMatch));
            return;
        }

        // cb when code completion is done
        completer.sender.on("completionResult", function tmp(event) {
            if (event.data.id != cId)
                return;

            // unregister this cb
            completer.sender.off("invokeCompletionReturn", tmp);

            last_results = event.data.results
            last_pos = pos;

            // send results back
            callback(filter_results(last_results, wMatch));
        });

        // send completion data to the server
        completer.sender.emit("completion", {
            pos: pos,
            id: cId
        });
    };

    // Propagate clang diagnostics
    completer.analyze = function(value, ast, callback) {
        // create a unique numeric id to identify correct callback relationships
        var cId = ++uId;

        // wait for the result and invoke the complete.callback function
        completer.sender.on("diagnoseResult", function invoTmp(ev) {
            if (ev.data.id != cId)
                return;

            // unregister this cb
            completer.sender.off("diagnoseResult", invoTmp);

            var results = []; // results to return
            _.forEach(ev.data.results, function(res) {
                var level = "";

                switch (res.severity) {
                    case 2:
                        level = "warning";
                        break;
                    case 3:
                        level = "error";
                        break;
                    default:
                        level = "info";
                        break;
                }

                results.push({
                    pos: {
                        sl: res.row-1,
                        sc: res.col-1
                    },
                    level: level,
                    message: res.summary
                });
            });

            callback(results);
        });

        // send the completion data to the server
        completer.sender.emit("diagnose", {
            id: cId
        });
    };
});
