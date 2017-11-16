import Queue from "./queue";

const queues = {};

export function init(queueName, queues) {
  const db = new Db(queues);
  queues[queueName] = db;
}

export async function open(queueName) {
  return queues[queueName].open();
}

export function __data(queueName) {
  return queues[queueName].queues;
}
