/**
 * @copyright 2015, Robin Dietrich
 * @license AGPLv3 <http://www.gnu.org/licenses/agpl.html>
 */
define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "settings", "preferences", "format", "proc", "c9", "tabManager"
    ];
    main.provides = ["cpp.format"];
    return main;

    function main(options, imports, register) {
        var _ = require("lodash");
        var Plugin = imports.Plugin;
        var plugin = new Plugin("Robin Dietrich", main.consumes);
        var settings = imports.settings;
        var prefs = imports.preferences;
        var format = imports.format;
        var proc = imports.proc;
        var c9 = imports.c9;
        var tabManager = imports.tabManager;

        // Initialize the plugin
        plugin.on("load", function() {
            format.addFormatter("C++ (clang_format)", "c_cpp", plugin);
            format.on("format", function(e) {
                if (e.mode == "c_cpp")
                    return formatCode(e.editor, e.mode);
            });
        });

        // Unload plugin
        plugin.on("unload", function(){
            format = null;
        });

        function formatCode(editor) {
            var ace = editor.ace;
            var sel = ace.selection;
            var session = ace.session;
            var range = sel.getRange();

            // Lines
            var lines = (range.start.row+1) + ":" + (range.end.row+1);
            var path  = c9.workspaceDir+tabManager.focussedTab.path;

            // Execute clang_format.sh script
            proc.execFile("/usr/home/dev/.c9/c9sdk/plugins/c9.ide.language.cpp/clang_format.sh", {
                args: ["Google", lines, path],
                cwd: "/"
            }, function(err, stdout, stderr) {
                if (err) {
                    console.log(err);
                    return;
                }

                tabManager.focussedTab.document.value = stdout;
            });
            
            return true;
        }

        // Public api for the formater
        // - Allow setting clang_format_path from the installer
        // - Allow loading specific configs by path
        plugin.freezePublicAPI({
            formatCode: formatCode
        });

        // Registers our plugin with C9
        register(null, { "cpp.format": plugin });
    }
});
