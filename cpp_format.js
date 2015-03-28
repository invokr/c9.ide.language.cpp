/**
 * @copyright 2015, Robin Dietrich
 * @license AGPLv3 <http://www.gnu.org/licenses/agpl.html>
 */
define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "settings", "preferences", "format", "proc", "c9", "tabManager", "save",
        "error_handler", "dialog.error"
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
        var save = imports.save;
        var errorHandler = imports.error_handler;
        var showError = imports["dialog.error"].show;

        // Identifier, Name, Type, Default, [range|values]
        var clang_settings = [
            ["AccessModifierOffset", "Access Modifier Offset", "int", 0, [0, 1024]],
            // ["AlignAfterOpenBracket", "Align after Open Bracket", "bool", false],
            ["AlignEscapedNewlinesLeft", "Align escaped Newlines left", "bool", true],
            // ["AlignOperands", "Align Operands", "bool", false],
            ["AlignTrailingComments", "Align trailing Comments", "bool", true],
            // ["AllowAllParametersOfDeclarationOnNextLine", "Allow all ", "", 0],
            ["AllowShortBlocksOnASingleLine", "Allow single line Blocks", "bool", true],
            // ["AllowShortCaseLabelsOnASingleLine", "Allow single line Labels", "bool", true],
            ["AllowShortFunctionsOnASingleLine", "Allow single line Functions", "enum", "Inline", ["None", "Inline", "Empty", "All"]],
            ["AllowShortIfStatementsOnASingleLine", "Allow single line If", "bool", true],
            ["AllowShortLoopsOnASingleLine", "Allow single line Loops", "bool", true],
            // ["AlwaysBreakAfterDefinitionReturnType", "Allow Break after Return", "bool", true],
            ["AlwaysBreakBeforeMultilineStrings", "Allow Break before Multiline Strings", "bool", true],
            ["AlwaysBreakTemplateDeclarations", "Always Break Template Declerations", "bool", false],
            // ["BinPackArguments", "Pack Arguments", "bool", false],
            ["BinPackParameters", "Pack Parameters", "bool", false],
            ["BreakBeforeBinaryOperators", "Break before Operators", "bool", false],
            ["BreakBeforeBraces", "Break before Braces", "enum", "Attach", ["Attach", "Linux", "Stroustrup", "Allman", "GNU"]],
            ["BreakBeforeTernaryOperators", "Break before ternary Operators", "bool", false],
            ["BreakConstructorInitializersBeforeComma", "Break Constructor Initializer before Comma", "bool", false],
            ["ColumnLimit", "Column Limit", "int", 0, [0, 1024]],
            ["CommentPragmas", "Comment Pragmas", "string", ""],
            ["ConstructorInitializerIndentWidth", "Constructor Intializer Indentation Width", "int", 0, [0, 1024]],
            ["ContinuationIndentWidth", "Continuation Indent Width", "int", 0, [0, 1024]],
            ["Cpp11BracedListStyle", "C++ 11 Braced-List Style", "bool", false],
            ["DerivePointerAlignment", "Derive Pointer Alignment", "bool", true],
            // ["DisableFormat", "", "", 0],
            // ["ExperimentalAutoDetectBinPacking", "", "", 0],
            // ["ForEachMacros", "For-Each Macros", "string", "BOOST_FOREACH"],
            ["IndentCaseLabels", "Indent Case Labels", "bool", false],
            ["IndentWidth", "Indent Width", "int", 4, [0, 1024]],
            ["IndentWrappedFunctionNames", "Indet Wrapped Function Names", "bool", true],
            ["KeepEmptyLinesAtTheStartOfBlocks", "Keep Empty Lines at the Start of Blocks", "bool", false],
            ["MaxEmptyLinesToKeep", "Maximum consecutive Empty Lines", "int", 0, [0, 1024]],
            ["NamespaceIndentation", "Namespace Indentation", "enum", "All", ["All", "Inner", "None"]],
            ["PointerAlignment", "Pointer Alignment", "enum", "Left", ["Left", "Right", "Middle"]],
            ["SpaceAfterCStyleCast", "Space after CStyle Cast", "bool", false],
            ["SpaceBeforeAssignmentOperators", "Space before assignment", "bool", true],
            ["SpaceBeforeParens", "Space before Parens", "enum", "ControlStatements", ["Always", ["ControlStatements", "After Control-Statement"], "Never"]],
            ["SpaceInEmptyParentheses", "Spaces in Empty Parentheses", "bool", false],
            ["SpacesBeforeTrailingComments", "Spaces before Trailing Comments", "int", 0, [0, 1024]],
            ["SpacesInAngles", "Spaces in Angle-Brackets", "bool", true],
            ["SpacesInCStyleCastParentheses", "Spaces in CStyle Cast Parentheses", "bool", false],
            ["SpacesInContainerLiterals", "Spaces in Container Literals", "bool", false],
            ["SpacesInParentheses", "Spaces in Parentheses", "bool", true],
            // ["SpacesInSquareBrackets", "Spaces in Square-Brackets", "bool", false],
            ["Standard", "C++ Standard", "enum", "Cpp11", ["Auto", ["Cpp03", "C++ 03"], ["Cpp11", "C++ 11"]]],
            ["TabWidth", "Tab Width", "int", 4, [0, 1024]],
            ["UseTab", "Use Tabs", "enum", "Never", ["Always", ["ForIndentation", "For Indentation"], "Never"]]
        ];

        var script = require("text!./clang_format.sh"); // clang-format wrapper

        // Initialize the plugin
        plugin.on("load", function() {
            // add formatter
            format.addFormatter("C++ (clang_format)", "c_cpp", plugin);
            format.on("format", function(e) {
                if (e.mode == "c_cpp")
                    return formatCode(e.editor, e.mode);
            });

            // Prepare preferences
            var myPrefs = {
                position: 100,
                "Coding Style": {
                    type: "dropdown",
                    width: 200,
                    path: "user/format/clang/@CodingStyle",
                    position: 1,
                    items: [
                        { value: "None", caption: "None" },
                        { value: "Chromium", caption: "Chromium" },
                        { value: "Google", caption: "Google" },
                        { value: "LLVM", caption: "LLVM" },
                        { value: "Mozilla", caption: "Mozilla" },
                        { value: "WebKit", caption: "WebKit" }
                    ]
                },
                "Allow Style Override": {
                    type: "checkbox",
                    path: "user/format/clang/@AllowOverride",
                    position: 2,
                }
            };
            var myDefaults = [["CodingStyle", "None"]];

            var position = 100;
            _.each(clang_settings, function (entry) {
                // Add default
                myDefaults.push([entry[0], entry[3]]);

                // Add actual preferences
                switch (entry[2]) {
                    case "bool":
                        myPrefs[entry[1]] = {
                            type: "checkbox",
                            path: "user/format/clang/@"+entry[0],
                            position: position++,
                        };
                        break;
                    case "enum":
                        myPrefs[entry[1]] = {
                            type: "dropdown",
                            path: "user/format/clang/@"+entry[0],
                            width: 200,
                            position: position++,
                            items: []
                        };

                        _.each(entry[4], function (item) {
                           if (typeof(item) != "string") {
                               myPrefs[entry[1]].items.push({ value: item[0], caption: item[1] });
                           } else {
                               myPrefs[entry[1]].items.push({ value: item, caption: item });
                           }
                        });
                        break;
                    case "int":
                        myPrefs[entry[1]] = {
                            type: "spinner",
                            path: "user/format/clang/@"+entry[0],
                            min: entry[4][0],
                            max: entry[4][1],
                            position: position++
                        };
                        break;
                    case "string":
                        myPrefs[entry[1]] = {
                            type: "textarea",
                            width: 200,
                            height: 130,
                            rowheight: 155,
                            path: "user/format/clang/@"+entry[0],
                            position: position++
                        };
                        break;
                }
            });

            // Add and set defaults
            prefs.add({ "Formatters" : { position: 450, "Clang-Format" : myPrefs } }, plugin);
            settings.on("read", function(e) { settings.setDefaults("user/format/clang", myDefaults); }, plugin);
        });

        // Unload plugin
        plugin.on("unload", function(){
            format = null;
        });

        function getSettings() {
            var ret = "{";
            _.each(clang_settings, function(val) {
                var v = settings.get("user/format/clang/@"+val[0]);

                if (v != "")
                    ret += val[0]+": "+settings.get("user/format/clang/@"+val[0])+", ";
            });

            return ret.substr(0, ret.length - 2)+"}";
        }

        function formatCode(editor) {
            var ace = editor.ace;
            var sel = ace.selection;
            var range = sel.getRange();

            // Lines
            var path  = c9.workspaceDir+tabManager.focussedTab.path;

            // Execute clang_format.sh script
            // See https://groups.google.com/forum/#!topic/cloud9-sdk/FuFkFH78cew
            proc.execFile("bash", {
                args: ["-c", script, getSettings(), path],
                cwd: "plugins/c9.ide.language.cpp"
            }, function(err, stdout, stderr) {
                if (err) {
                    errorHandler.reportError(err);
                    return showError("[c9.ide.language.cpp.format] Can't run wrapper script: " + (err.message | err));
                }

                if (stderr.length > 1) {
                    // Some invalid options or other stuff
                    // @todo build own binary that is backwards compatible and doesn't choke up
                    errorHandler.reportError(stderr);
                    return showError("[c9.ide.language.cpp.format] Incompatible clang-format binary: " + (err.message | err));
                } else if (stdout.length > 1) {
                    // We have formatted the content, go replace
                    save.save(tabManager.focussedTab, {}, function(err) {
                        if (err) {
                            errorHandler.reportError(stderr);
                            return showError("[c9.ide.language.cpp.format] Error saving document: " + (err.message | err));
                        }

                        tabManager.focussedTab.document.value = stdout;
                    });
                } else {
                    // Clang-Format binary could not be found
                    errorHandler.reportError("Clang-Format not installed or found.");
                    return showError("[c9.ide.language.cpp.format] Clang-Format not installed or found.");
                }
            });

            return true;
        }

        // Public api for the formater
        // - Allow setting clang_format_path from the installer
        // - Allow loading specific configs by path
        plugin.freezePublicAPI({
            formatCode: formatCode,
            clangSettingsString: getSettings
        });

        // Registers our plugin with C9
        register(null, { "cpp.format": plugin });
    }
});
