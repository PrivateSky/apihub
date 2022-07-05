const fs = require("fs");

function FSLock(filePath, maxTimeMilliSeconds, forcedLockDelay) {
    maxTimeMilliSeconds = maxTimeMilliSeconds || 5000;
    forcedLockDelay = forcedLockDelay || 10000;
    let lockCreationTime;
    const removeDir = require("swarmutils").removeDir;
    this.acquireLock = (callback) => {
        fs.mkdir(getLockPath(), async err => {
            if (err) {
                if (await lockIsExpired()) {
                   return attemptToReacquireExpiredLock(callback);
                }

                return callback(Error(`File ${filePath} is being updated by another process.`));
            }

            lockCreationTime = await getLockCreationTime();
            callback();
        })
    }

    this.releaseLock = (callback) => {
        this.isMyLock((err, isMyLock) => {
            if (err) {
                return callback(err);
            }
            if (isMyLock) {
                return removeDir(getLockPath(filePath), {recursive: true}, callback);
            }

            callback(Error(`The lock is owned by another instance.`));
        })
    }

    this.isMyLock = (callback) => {
        getLockCreationTime(filePath).then(creationTime => {
            let isOwnLock = false;
            if (creationTime === lockCreationTime) {
                isOwnLock = true;
            }
            callback(undefined, isOwnLock);
        });
    }

    const lockIsExpired = async () => {
        const lockStartingTime = await getLockCreationTime();
        if (Date.now() - lockStartingTime > maxTimeMilliSeconds) {
            return true;
        }

        return false;
    };


    const releaseExpiredLock = (callback)=>{
        return setTimeout(() => {
            removeDir(getLockPath(), {recursive: true}, (err)=>{
                if (err) {
                    return callback(err);
                }

                callback();
            });
        }, forcedLockDelay);
    }

    const attemptToReacquireExpiredLock = (callback)=>{
        releaseExpiredLock(err=>{
            if (err) {
                return callback(err);
            }

            this.acquireLock(callback);
        })
    }

    const getLockCreationTime = async () => {
        let stats;
        try {
            stats = await $$.promisify(fs.stat)(getLockPath());
        } catch (e) {
            return 0;
        }
        return stats.birthtimeMs;
    }

    const getLockPath = () => {
        return `${filePath}.lock`;
    }
}

module.exports = FSLock;