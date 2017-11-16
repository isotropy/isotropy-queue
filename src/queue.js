import exception from "./exception";

export default class Queue {
  constructor(queues) {
    this.itemCounter = 0;
    this.queues = queues.map(q => ({
      ...q,
      options: q.options || { lifo: false, autoDelete: true },
      items: q.items.map(i => ({
        ...i,
        id: (this.itemCounter++).toString(),
        read: !!i.read,
        timestamp: i.timestamp || Date.now()
      }))
    }));
  }

  addQueue(queue) {
    this.queues = this.queues.concat(queue);
  }

  replaceQueue(queue, newQueue) {
    this.queues = this.queues.map(x => (x === queue ? newQueue : x));
  }

  withQueue(name, fn) {
    const queue = this.queues.find(x => x.name === name);
    return queue ? fn(queue) : exception(`Queue ${name} not found.`);
  }

  async deleteQueue(name) {
    this.queues = this.queues.filter(x => x.name === name);
  }

  async getMessages(name, id) {
    return this.withQueue(name, queue =>
      queue.items.filter(x => (Array.isArray(id) ? id : [id]).includes(x.id))
    );
  }

  async getQueues() {
    return this.queues.map(x => x.name);
  }

  async close() {
    this.state = "CLOSED";
  }

  async createQueue(name, options = { lifo: false, autoDelete: true }) {
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

  async open() {
    this.state = "OPEN";
    return this;
  }

  async peek(name, count = 1, options = {}) {
    return this.withQueue(
      name,
      queue =>
        queue.items.length
          ? (queue.options.lifo
              ? arr => arr.slice(-count).reverse()
              : arr => arr.slice(0, count))(
              options.read ? queue.items : queue.items.filter(i => !i.read)
            ).map(i => ({ id: i.id, timestamp: i.timestamp, read: i.read }))
          : []
    );
  }

  async purgeQueue(name) {
    return this.withQueue(
      name,
      queue => (this.replaceQueue(queue, { ...queue, items: [] }), true)
    );
  }

  async receive(name, count = 1, options = {}) {
    return this.withQueue(
      name,
      queue =>
        queue.items.length
          ? queue.options.autoDelete
            ? (() => {
                const items = queue.options.lifo
                  ? queue.items.slice(-count).reverse()
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
                  ? valid.slice(-count).reverse()
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

  async removeMessages(name, id) {
    return this.withQueue(name, queue => {
      this.replaceQueue(queue, {
        ...queue,
        items: queue.items.filter(x =>
          !(Array.isArray(id) ? id : [id]).includes(x.id)
        )
      });
      return true;
    });
  }

  async send(name, message) {
    return this.withQueue(name, queue => {
      const newItems = (Array.isArray(message)
        ? message
        : [message]
      ).map(msg => ({
        id: (this.itemCounter++).toString(),
        message: msg,
        read: false,
        timestamp: Date.now()
      }));
      this.replaceQueue(queue, {
        ...queue,
        items: queue.items.concat(newItems)
      });
      return newItems.map(x => x.id);
    });
  }
}
