const QueueElement = require('./QueueElement');

function Queue() {
    this.head = null;
    this.tail = null;

    this.push = function (value) {
        let newElement = new QueueElement(value, null);
        if (!this.head) {
            this.head = newElement;
            this.tail = newElement;
        } else {
            this.tail.next = newElement;
            this.tail = newElement
        }
    };

    this.pop = function () {
        if (!this.head) {
            return null;
        }
        const headCopy = this.head;
        this.head = this.head.next;
        return headCopy
    };

    this.front = function () {
        return this.head;
    };

    this.isEmpty = function () {
        return this.head == null;
    };
}

Queue.prototype.toString = function () {
    let stringifiedQueue = '';
    let iterator = this.head;
    while (iterator) {
        stringifiedQueue += `${JSON.stringify(iterator.content)} `;
        iterator = iterator.next;
    }
    return stringifiedQueue
};

Queue.prototype.inspect = Queue.prototype.toString;

module.exports = Queue;