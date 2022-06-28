function AnchorPathResolver(rootFolder, configPath) {
    const path = require("path");
    const anchoringFolder = path.resolve(path.join(rootFolder, configPath));

    this.getAnchorPath = (anchorId) => {
        return path.join(anchoringFolder, anchorId);
    }
}

module.exports = AnchorPathResolver;