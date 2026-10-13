export class RowIterator<T, U> implements Iterator<U> {
  private readonly rows: readonly T[];
  private index = 0;

  constructor(rows: readonly T[], private readonly transform: (row: T) => U) {
    this.rows = rows;
  }

  next(): IteratorResult<U> {
    if (this.index >= this.rows.length) {
      return { done: true, value: undefined };
    }
    return { done: false, value: this.transform(this.rows[this.index++]) };
  }

  toArray(): U[] {
    const output: U[] = [];
    for (let item = this.next(); !item.done; item = this.next()) {
      output.push(item.value);
    }
    return output;
  }

  [Symbol.iterator](): Iterator<U> {
    return this;
  }
}