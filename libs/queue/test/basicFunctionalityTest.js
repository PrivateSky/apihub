const Queue = require('../../queue');

let queue = new Queue();
queue.push('str1');
queue.push(1);
queue.push({"msg": "salut"});

console.log(queue);
console.log(queue.front());
console.log(queue.pop());
console.log(queue.front());
console.log(queue);
console.log(queue.front());
