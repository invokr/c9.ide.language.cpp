define(function(require, exports, module) {

module.exports = function(session, options){
    session.introduction = require("text!./intro.html");
    session.preInstallScript = require("text!./check-deps.sh");

    // libclang pkgs
    var pkgs = ['llvm-3.5', 'llvm-3.5-dev', 'lvm-3.5-runtime', 'libclang-3.5-dev', 'libclang1-3.5'];

    for (var i = 0; i < pkgs.length; ++i) {
        session.install({
            "name": pkgs[i],
            "description": "Plugin Dependency",
            "cwd": "~/.c9"
        }, {
            "install": [
                {
                    "ubuntu": pkgs[i]
                }
            ]
        });
    }

    // Show the installation screen
    session.start();
};

});
