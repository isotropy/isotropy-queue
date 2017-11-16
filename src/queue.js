export default class Queue {
  constructor(queues) {
    this.queues = queues;
    this.itemCounter = 0;
  }

  addQueue(queue) {
    this.queues = this.queues.concat({ ...queue, name: this.idCounter++ });
  }

  replaceQueue(queue, newObj) {
    this.queues = this.queues.map(o => (o === queue ? newObj : o));
  }

  withQueue(key, fn) {
    const queue = this.queues.find(x => x.key === key);
    return queue
      ? isQueue(queue.value)
        ? fn(queue)
        : exception(`The value with key ${key} is not an queue.`)
      : fn({ key, value: {} });
  }

  async createQueue(name, options = { fifo: true, autoDelete: true }) {
    const existing = this.queues.find(x => x.name === name);
    return !existing
      ? (this.addQueue({
          name,
          options,
          items: []
        }),
        true)
      : exception(`A queue named ${name} already exists.`);
  }

  async purgeQueue(name) {
    return withQueue(
      name,
      queue => (this.replaceQueue(queue, { ...queue, items: [] }), true)
    );
  }

  async deleteQueue(name) {
    this.queues = this.queues.filter(x => x.name === name);
  }

  async send(name, message) {
    return withQueue(
      name,
      queue =>
        (Array.isArray(message) ? message : [message]).forEach(msg =>
          this.replaceQueue(queue, {
            ...queue,
            items: queue.items.concat({
              __id: itemCounter++,
              timestamp: Date.now(),
              message: msg
            })
          })
        ),
      true
    );
  }

  async receive(name, count = 1, options = {}) {
    return withQueue(
      name,
      queue =>
        queue.items.length
          ? queue.options.autoDelete
            ? (() => {
                const items = queue.options.lifo
                  ? queue.items.slice(-count)
                  : queue.items.slice(0, count);
                this.replaceQueue(queue, {
                  ...queue,
                  items: queue.items.filter(i => !items.includes(i))
                });
                return items;
              })()
            : (() => {
                const valid = options.read
                  ? queue.items
                  : queue.items.filter(i => !i.read);

                const items = queue.options.lifo
                  ? valid.slice(-count)
                  : valid.slice(0, count);

                const updatedItems = queue.items.map(
                  i => (items.includes(i) ? { ...i, read: true } : i)
                );

                this.replaceQueue(queue, { ...queue, items: updatedItems });

                return items;
              })()
          : []
    );
  }

  async peek(name, count = 1, options = {}) {
    return withQueue(
      name,
      queue =>
        queue.items.length
          ? (queue.options.lifo
              ? arr => arr.slice(-count)
              : arr => arr.slice(0, count))(
              options.read ? queue.items : queue.items.filter(i => !i.read)
            ).map(i => ({ __id: i.__id, timestamp: i.timestamp, read: i.read }))
          : []
    );
  }

  async getMessages(name, id) {
    return withQueue(name, queue =>
      queue.items.filter(x => (Array.isArray(id) ? id : [id]).includes(x.__id))
    );
  }

  async removeMessages(name, id) {
    return withQueue(name, queue => {
      id.forEach(_id => {
        this.replaceQueue(queue, {
          ...queue,
          items: queue.items.filter(x =>
            (Array.isArray(id) ? id : [id]).includes(x.__id)
          )
        });
      });
      return true;
    });
  }
}
