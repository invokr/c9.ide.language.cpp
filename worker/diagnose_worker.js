/**
 * @copyright 2015, Robin Dietrich
 * @license AGPLv3 <http://www.gnu.org/licenses/agpl.html>
 */
define(function(require, exports, module) {
    var completeUtil = require("plugins/c9.ide.language/complete_util");
    var baseLanguageHandler = require('plugins/c9.ide.language/base_handler');
    var worker_util = require("plugins/c9.ide.language/worker_util");
    var _ = require("plugins/c9.nodeapi/lodash");

    var analyzer = module.exports = Object.create(baseLanguageHandler);
    var uId = 0;

    // takes care of initial plugin registration
    analyzer.init = function(callback) {
        callback();
    };

    // check if we handle the language
    analyzer.handlesLanguage = function(language) {
        return language === "c_cpp";
    };

    // do some code completion magic
    analyzer.analyze = function(value, ast, callback) {
        // create a unique numeric id to identify correct callback relationships
        var cId = ++uId;

        // wait for the result and invoke the complete.callback function
        analyzer.sender.on("diagnoseReturn", function invoTmp(ev) {
            if (ev.data.id != cId)
                return;

            // unregister this cb
            analyzer.sender.off("diagnoseReturn", invoTmp);

            var results = []; // results to return
            _.forEach(ev.data.results, function(res) {
                var level = "";

                switch (res[4]) {
                    case 2:
                        level = "warning";
                        break;
                    case 3:
                        level = "error";
                        break;
                    case 0:
                    case 1:
                    default:
                        level = "info";
                        break;
                }

                // clang diagnoses all includes in the translation unit, we only want the active file
                if (res[0] == ev.data.path)
                    results.push({
                        pos: {
                            sl: res[1]-1,
                            sc: res[2]-1
                        },
                        level: level,
                        message: res[3]
                    });
            });

            callback(results);
        });


        // send the completion data to the server
        analyzer.sender.emit("invokeDiagnose", {
            id: cId
        });
    };
});