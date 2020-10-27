module.exports = function doAnchor(jsonparam,callback){

    console.log('called doAnchor');
    console.log('data received : ', jsonparam);

    callback(undefined,"doAnchor finished.")
};