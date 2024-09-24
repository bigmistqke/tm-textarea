export class Stack<T> {
  #array: Array<T> = []
  peek() {
    return this.#array[this.#array.length - 1]
  }
  push(value: T) {
    this.#array.push(value)
  }
  pop() {
    return this.#array.pop()
  }
}
