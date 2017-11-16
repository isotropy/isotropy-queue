import Queue from "./queue";

const queues = {};

export function init(queueName, data) {
  const queue = new Queue(data);
  queues[queueName] = queue;
}

export async function open(queueName) {
  return queues[queueName].open();
}

export function __data(queueName) {
  return queues[queueName].queues;
}
