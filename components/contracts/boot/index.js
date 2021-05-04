function getBootScript() {
    // currently only nodejs environment is supported
    return require("./NodeBootScript");
}

module.exports = getBootScript();
