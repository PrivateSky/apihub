const fs = require('fs');
const path = require('swarmutils').path;
const BRICKSFABRIC_ERROR_CODE = 'bricks fabric error';
let rootFolder;
let transactionsPerBlock;
const pendingTransactions = [];
let lastBlockHashLink;


const hashlinkfile = 'lasthashlink';


$$.flow.describe('BrickStorage', {

    init : function (brickFabricRootFolder,noOfTransactionsPerBlock) {
        rootFolder = brickFabricRootFolder;
        transactionsPerBlock = noOfTransactionsPerBlock;

    },
    bootUp : function(){
      //get latest hashlink
        const hashlinkpath = path.join(rootFolder,hashlinkfile);
        if (fs.existsSync(hashlinkpath))
        {
            lastBlockHashLink = fs.readFileSync(hashlinkpath).toString();
        }
    },
    __storeLastHashLink : function () {
        const hashlinkpath = path.join(rootFolder,hashlinkfile);
        fs.writeFileSync(hashlinkpath,lastBlockHashLink);
    },
    completeBlock : async function () {


        if (pendingTransactions.length === 0)
        {
            console.log('No pending transactions.');
            return;
        }

        //build block
        const blockId = $$.uidGenerator.safe_uuid();
        const block = {
            'blockId' : blockId,
            'previousBlockHashLink' : lastBlockHashLink,
            'transactions' : []

        };

        for (let i = 0; i < pendingTransactions.length; i++) {
            block.transactions.push(pendingTransactions[i])
        }

        lastBlockHashLink = await this.__SaveBlockToBrickStorage(JSON.stringify(block));
        this.__storeLastHashLink();

        pendingTransactions.splice(0, pendingTransactions.length);
        console.log(block);
        console.log('block finished');
    },
    __SaveBlockToBrickStorage : async function (data){

        const putBrickAsync = require('../utils').putBrickAsync;
        const result = await putBrickAsync(data);
        const resultJson =  JSON.parse(result);
        console.log('hashlink : ',resultJson.message);
        console.log(resultJson);
        return resultJson.message;
    },
    storeData : async function (anchorData) {
        pendingTransactions.push(anchorData);
        if (pendingTransactions.length === transactionsPerBlock)
        {
           await this.completeBlock();
        }
    }









});

module.exports = { BRICKSFABRIC_ERROR_CODE};