export class MemoryStorage {
  readonly #items = new Map<string, string>();

  get length() {
    return this.#items.size;
  }

  key(index: number) {
    return [...this.#items.keys()][index] ?? null;
  }

  getItem(key: string) {
    return this.#items.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.#items.set(key, String(value));
  }

  removeItem(key: string) {
    this.#items.delete(key);
  }

  clear() {
    this.#items.clear();
  }

  keys() {
    return [...this.#items.keys()];
  }
}
