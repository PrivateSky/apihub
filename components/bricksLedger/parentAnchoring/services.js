const fs = require('fs');

function addAnchor(anchorId) {
    return new Promise((resolve, reject) => {
        fs.appendFile('anchor.txt', `${anchorId},`, (err) => {
            if (err) {
                return reject(err);
            }

            resolve();
        })
    })
}

module.exports = { addAnchor };