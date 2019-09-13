require("../../../psknode/bundles/pskruntime");
require("../../../psknode/bundles/virtualMQ");
require("../../../psknode/bundles/psknode");
const double_check = require("double-check");
const assert = double_check.assert;
const path = require('path');
const Duplex = require('stream').Duplex;
const fileStateManager = require('../../../libraries/utils/FileStateManager').getFileStateManager();
const fs = require('fs');

var fileName = 'test.txt';
const demoFileBufferSize = 100000;

let tempFolder;
let demoFileStream;
let tempReadStream;

double_check.createTestFolder("CSBManagerFlow", (err, res)=>{
	assert.isNull(err, "Got an error");
	tempFolder = res;

	demoFileStream =  fs.createWriteStream(path.join(tempFolder, fileName));
	tempReadStream = fs.createReadStream(path.join(tempFolder, fileName));

	assert.callback("CSBmanagerFlowTest", function (callback) {
		flow.init(callback);
	}, 1000);
});

const flow = $$.flow.describe('CSBmanagerFlowTest', {
	init: function (callback) {
		this.cb = callback;
		fileStateManager.saveState([tempFolder], () => {
			//console.log('**************this is the temporary folder************* '+tempFolder);
			this.__initializeCSBManager((err) => {
				assert.false(err, 'Error initializing CSBManager: ' + (err && err.message));
				this.__getDemoFileStream();
				this.__writeFile();
				this.__readFile();
			});
		});
	},
	__initializeCSBManager: function (callback) {
		//console.log("Entered in initialization func scope!!!");
		this.CSBManager = $$.flow.describe('CSBManager',{
			init:function(){
				this.CSBManager = $$.flow.describe('CSBmanager');
				this.CSBManager.init(`${tempFolder}`, callback);
			},
			write:function(fileName, demoFileStream, writeCallback){
				let flag = false;
				fs.open(fileName, 'r+', (err, fd) => {
					//console.log("$$$$$$$$ "+ fd);
					fs.write(fd, demoFileStream.read(), (err, content) => {
						//console.log('------------------------Write');
						if (err) flag = true;
						console.log('Content saved: '+ content + ' abc`s');
					});
				  })
				writeCallback(flag);
			},
			read:function(fileName){
				//console.log("Read file!!!!!!!");
				fs.readFile(fileName, 'utf8', (err, contents) => {
					if (err) throw err;
					console.log('Content read: '+ contents.toString());
					assert.equal('abcabcabcabcabcabcabcabca', contents.toString(), 'Contents are not similar');
				})
			}
		})();

		let response  = this.CSBManager ? false : true;
		callback(response);
	},

	__getDemoFileStream: function () {
		//console.log("Entered in getDemoFileStream func scope!!!");
		demoFileStream = bufferToStream(Buffer.alloc(25, 'abc'));
	},
	__writeFile: function () {
		//console.log("Entered in writeFile func scope!!!");
		this.CSBManager.write(fileName, demoFileStream, (err) => {
			assert.false(err, "Error writing demo file: " + (err && err.message));
		});
		//console.log("file was written!! " + demoFileStream.read()) ;
	},
	__readFile: function () {
		//console.log("Entered in readFile func scope!!!");

		this.CSBManager.read(fileName, tempReadStream, (err) => {
			assert.false(err, "Error reading demo file: " + (err && err.message));

			streamToBuffer(fs.tempReadStream, (err, buffer) => {
				if (err) {
					throw err;
				}

				let match = true;
				if (buffer.length !== demoFileBufferSize) {
					match = false;
				} else {
					for (let i = 0; i < demoFileBufferSize; ++i) {
						if (buffer[i] !== 'a') {
							match = false;
							break;
						}
					}
				}

				assert.true(match, "Read was not successful");

				fileStateManager.restoreState(this.cb);
			});
		});
		//console.log("File was read!!! ");
	}
})();

function bufferToStream(buffer) {
	const stream = new Duplex();
	stream.push(buffer);
	stream.push(null);
	return stream;
}

function streamToBuffer(stream, callback) {
	const buffers = [];
	stream.on('error', callback);
	stream.on('data', (data) => buffers.push(...data.toString('utf8')));
	stream.on('end', () => callback(null, buffers));
}
