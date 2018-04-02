const Queue = require('../index');

let queue = new Queue();
let array = [];
const iterations = 100000;

console.time("Queue Insertion Time");
for (let i = 1; i <= iterations; ++i) {
    queue.push(i);
}
console.timeEnd("Queue Insertion Time");
console.log('===============================================');

console.time("Array Insertion Time");
for (let i = 1; i <= iterations; ++i) {
    array.push(i);
}
console.timeEnd("Array Insertion Time");
console.log('===============================================');

console.time("Queue Pop Time");
while (!queue.isEmpty()) {
    queue.pop();
}
console.timeEnd("Queue Pop Time");
console.log('===============================================');

console.time("Array Shift Time");
while (array.length > 0) {
    array.shift();
}
console.timeEnd("Array Shift Time");
console.log('===============================================');

for (let i = 1; i <= iterations; ++i) {
    array.push(i);
}
console.time("Array Reverse + Pop Time");
array = array.reverse();
while (array.length > 0) {
    array.pop();
}
console.timeEnd("Array Reverse + Pop Time");
console.log('===============================================');
