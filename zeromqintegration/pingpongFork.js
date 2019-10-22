const PING = "PING";
const PONG = "PONG";

module.exports.fork = function pingPongFork(modulePath, args, options){
    const child_process = require("child_process");
    const defaultStdio = ["inherit", "inherit", "inherit", "ipc"];

    if(!options){
        options = {stdio: defaultStdio};
    }else{
        if(typeof options.stdio === "undefined"){
            options.stdio = defaultStdio;
        }

        let stdio = options.stdio;
        if(stdio.length<3){
            for(let i=stdio.length; i<4; i++){
                stdio.push("inherit");
            }
            stdio.push("ipc");
        }
    }

    let child = child_process.fork(modulePath, args, options);

    child.on("message", (message)=>{
        if(message === PING){
            console.log("Got a PING message from child. Responding with a PONG");
            child.send(PONG);
        }
    });

    return child;
};

module.exports.enableLifeLine = function(timeout){
    let lastConfirmationTime;
    const interval = timeout || 2000;

    function sendPing(){
        process.send(PING);
    }

    process.on("message", function (message){
        if(message === PONG){
            lastConfirmationTime = new Date().getTime();
        }
    });

    setInterval(function(){
        const currentTime = new Date().getTime();
        if(typeof lastConfirmationTime === "undefined" || currentTime-lastConfirmationTime<interval){
            console.log("Sending a PING message to check is parent still present.");
            sendPing();
        }else{
            console.log("Parent process did not answer. Shuting down...");
            process.exit(1);
        }
    }, interval);
};