const fs = require('fs');
const path = require('swarmutils').path;

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
            fs.rmdirSync(filePath);
        }
    }
}

module.exports = cleanUp;
