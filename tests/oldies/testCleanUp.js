const fs = require('fs');
const path = require('swarmutils').path;
const removeDirSync = require("swarmutils").removeDirSync;

function cleanUp(filePath) {
    if (fs.existsSync(filePath)) {
        if (!fs.statSync(filePath).isDirectory()) {
            fs.unlinkSync(filePath);
        } else {
            const files = fs.readdirSync(filePath);
            for (let index = 0; index < files.length; ++index) {
                const innerFilePath = path.join(filePath, files[index]);
                cleanUp(innerFilePath);
            }
            removeDirSync(filePath);
        }
    }
}

module.exports = cleanUp;
