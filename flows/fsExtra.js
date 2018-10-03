const path = require("path");
const fs = require("fs");


$$.flow.describe('fsExtra', {
    getFolderSize: function (folder, callback) {
        let total = 0;

        folder = path.resolve(folder);

        fs.readdir(folder, (err, files) => {
            if (err) {
                return callback(err);
            }

            let remainingFiles = files.length;

            if (!remainingFiles) {
                return callback(undefined, total);
            }

            for (let i = 0; i < files.length; ++i) {
                const filePath = path.join(folder, files[i]);
                fs.stat(filePath, (err, stats) => {
                    if (err) {
                        return callback(err);
                    }

                    if (stats.isDirectory()) {
                        this.getFolderSize(filePath, (err, size) => {
                            if (err) {
                                console.error(err);
                                return callback(err);
                            }

                            total += size;

                            if (!--remainingFiles) {
                                callback(undefined, total);
                            }
                        });

                    } else {
                        total += stats.size;


                        if (--remainingFiles === 0) {

                            callback(undefined, total);
                        }
                    }
                });
            }
        });
    }
});
