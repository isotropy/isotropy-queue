import should from "should";
import * as babel from "babel-core";
import sourceMapSupport from "source-map-support";
import { log } from "util";
import * as queue from "../isotropy-queue";

sourceMapSupport.install();

function getQueue(name) {
  return queue.__data("testqueue").find(x => x.name === name);
}

describe("Isotropy Redis", () => {
  beforeEach(() => {
    const queues = [
      {
        name: "sites",
        items: [
          "https://www.google.com",
          "https://www.apple.com",
          "https://www.amazon.com",
          "https://www.twitter.com"
        ].map(x => ({
          message: x
        }))
      },
      {
        name: "users",
        items: ["jeswin", "tommi", "deepa", "janie"].map(x => ({
          message: x
        }))
      },
      {
        name: "files",
        options: { autoDelete: false, lifo: false },
        items: ["jennam.png", "lizlemon.jpg", "30rock.png"].map(x => ({
          message: x
        }))
      },
      {
        name: "zips",
        options: { autoDelete: true, lifo: true },
        items: ["docs.zip", "pics.zip", "rocks.zip"].map(x => ({
          message: x
        }))
      }
    ];

    queue.init("testqueue", queues);
  });

  it(`Returns all queues`, async () => {
    const conn = await queue.open("testqueue");
    const result = await conn.getQueues("*");
    result.should.deepEqual(["sites", "users", "files", "zips"]);
  });

  it(`Send message to queue`, async () => {
    const conn = await queue.open("testqueue");
    const result = await conn.send("sites", "https://www.looptype.com");
    result.should.deepEqual(["14"]);
    getQueue("sites").items.length.should.equal(5);
    getQueue("sites")
      .items.filter(x => x.message === "https://www.looptype.com")
      .length.should.equal(1);
  });

  it(`Send multiple messages to queue`, async () => {
    const conn = await queue.open("testqueue");
    const result = await conn.send("sites", [
      "https://www.looptype.com",
      "https://edit.looptype.com"
    ]);
    result.should.deepEqual(["14", "15"]);
    getQueue("sites").items.length.should.equal(6);
    getQueue("sites")
      .items.filter(x => x.message === "https://www.looptype.com")
      .length.should.equal(1);
    getQueue("sites")
      .items.filter(x => x.message === "https://edit.looptype.com")
      .length.should.equal(1);
  });

  it(`Create a new queue`, async () => {
    const conn = await queue.open("testqueue");
    const result = await conn.createQueue("pics");
    result.should.be.true();
    getQueue("pics").should.not.be.empty();
    getQueue("pics").options.lifo.should.be.false();
    getQueue("pics").options.autoDelete.should.be.true();
  });

  it(`Failes to create a queue which exists`, async () => {
    const conn = await queue.open("testqueue");
    let ex;
    try {
      const result = await conn.createQueue("files");
    } catch (_ex) {
      ex = _ex;
    }
    ex.message.should.equal("A queue named files already exists.");
  });

  it(`Purge a queue`, async () => {
    const conn = await queue.open("testqueue");
    const result = await conn.purgeQueue("users");
    result.should.be.true();
    getQueue("users").items.should.be.empty();
  });

  it(`Receive one item from a queue`, async () => {
    const conn = await queue.open("testqueue");
    const result = await conn.receive("users");
    result
      .map(i => ({ id: i.id, message: i.message }))
      .should.deepEqual([{ message: "jeswin", id: "4" }]);
    getQueue("users").items.length.should.equal(3);
    getQueue("users")
      .items.filter(x => x.message === "jeswin")
      .should.be.empty();
  });

  it(`Receive multiple items from a queue`, async () => {
    const conn = await queue.open("testqueue");
    const result = await conn.receive("users", 2);
    result
      .map(i => ({ id: i.id, message: i.message }))
      .should.deepEqual([
        { message: "jeswin", id: "4" },
        { message: "tommi", id: "5" }
      ]);
    getQueue("users").items.length.should.equal(2);
    getQueue("users")
      .items.filter(x => x.message === "jeswin")
      .should.be.empty();
  });

  it(`Receive multiple items when autoDelete is false`, async () => {
    const conn = await queue.open("testqueue");
    const result = await conn.receive("files", 2);
    result
      .map(i => ({ id: i.id, message: i.message }))
      .should.deepEqual([
        { message: "jennam.png", id: "8" },
        { message: "lizlemon.jpg", id: "9" }
      ]);
    getQueue("files").items.length.should.equal(3);
    getQueue("files")
      .items.filter(x => x.read)
      .map(i => ({ id: i.id, message: i.message, read: i.read }))
      .should.deepEqual([
        {
          id: "8",
          message: "jennam.png",
          read: true
        },
        {
          id: "9",
          message: "lizlemon.jpg",
          read: true
        }
      ]);
  });

  it(`Receive multiple items from a lifo queue`, async () => {
    const conn = await queue.open("testqueue");
    const result = await conn.receive("zips", 2);
    result
      .map(i => ({ id: i.id, message: i.message }))
      .should.deepEqual([
        { message: "rocks.zip", id: "13" },
        { message: "pics.zip", id: "12" }
      ]);
    getQueue("zips").items.length.should.equal(1);
  });

  it(`Gets message information`, async () => {
    const conn = await queue.open("testqueue");
    const result = await conn.peek("files", 2);
    Object.keys(result[0]).should.deepEqual(["id", "timestamp", "read"]);
    Object.keys(result[1]).should.deepEqual(["id", "timestamp", "read"]);
  });

  it(`Removes messages`, async () => {
    const conn = await queue.open("testqueue");
    const result = await conn.removeMessages("sites", "0");
    getQueue("sites").items.length.should.equal(3);
  });

  it(`Removes multiple messages`, async () => {
    const conn = await queue.open("testqueue");
    const result = await conn.removeMessages("sites", ["0", "1"]);
    getQueue("sites").items.length.should.equal(2);
  });

  it(`Gets messages`, async () => {
    const conn = await queue.open("testqueue");
    const result = await conn.getMessages("sites", "0");
    result
      .map(x => ({ id: x.id, message: x.message, read: x.read }))
      .should.deepEqual([
        {
          id: "0",
          message: "https://www.google.com",
          read: false
        }
      ]);
  });

  it(`Gets multiple messages`, async () => {
    const conn = await queue.open("testqueue");
    const result = await conn.getMessages("sites", ["0", "1"]);
    result
      .map(x => ({ id: x.id, message: x.message, read: x.read }))
      .should.deepEqual([
        {
          id: "0",
          message: "https://www.google.com",
          read: false
        },
        {
          id: "1",
          message: "https://www.apple.com",
          read: false
        }
      ]);
  });
});
