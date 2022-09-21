export default class Queue {
    constructor() {
      this.items = {};
      this.front = 0;
      this.rear = 0;
    }
    enqueue(item) {
      this.items[this.rear] = item;
      this.rear++;
    }
    dequeue() {
      const item = this.items[this.front];
      delete this.items[this.front];
      this.front++;
      return item;
    }
    peek() {
      return this.items[this.front];
    }
    get size() {
      return this.rear - this.front;
    }
    isEmpty() {
      return this.rear == 0;
    }
    delete(index){
      if(index<this.front || index >= this.rear){
        throw new Error("Index not in queue")
      }
      if(index === this.front){
        delete this.items[this.front++]
        return;
      }
      if(index === (this.rear - 1)){
        delete this.items[this.rear - 1];
        this.rear--;
        return;
      }  
      for(let i = index;i<(this.rear-1); i++){
        this.items[i] = this.items[i+1]
      }
      delete this.items[this.rear - 1 ];
      this.rear--;
    }
  }
  //module.exports = Queue;