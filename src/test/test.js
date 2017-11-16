import should from "should";
import * as babel from "babel-core";
import sourceMapSupport from "source-map-support";
import { log } from "util";
import * as db from "../isotropy-queue";

sourceMapSupport.install();

function table(name) {}

describe("Isotropy Redis", () => {
  beforeEach(() => {
    const objects = [
      {
        key: "site1",
        value: "https://www.google.com"
      },
      {
        key: "site2",
        value: "https://www.apple.com",
        expiry: 1530800000000
      },
      {
        key: "site3",
        value: "https://www.amazon.com"
      },
      {
        key: "site4",
        value: "https://www.twitter.com"
      },
      {
        key: "user1",
        value: "jeswin",
        tags: ["admin"]
      },
      {
        key: "user2",
        value: "deeps"
      },
      {
        key: "user3",
        value: "tommi"
      },
      {
        key: "countries",
        value: ["vietnam", "france", "belgium"]
      },
      {
        key: "total",
        value: 1000
      },
      {
        key: "user:99",
        value: {
          username: "janie",
          country: "India",
          verified: 1
        }
      }
    ];

    db.init("testdb", objects);
  });

  it(`Returns all keys`, async () => {
    const conn = await db.open("testdb");
    const result = await conn.keys("*");

    result.should.deepEqual([
      "site1",
      "site2",
      "site3",
      "site4",
      "user1",
      "user2",
      "user3",
      "countries",
      "total",
      "user:99"
    ]);
  });

  it(`Returns all keys starting with site`, async () => {
    const conn = await db.open("testdb");
    const result = await conn.keys("site*");
    conn.close();
    result.should.deepEqual(["site1", "site2", "site3", "site4"]);
  });

  it(`Returns whether a key exists`, async () => {
    const conn = await db.open("testdb");
    const result = await conn.exists("site1");
    conn.close();
    result.should.be.true();
  });

  it(`Rename a key`, async () => {
    const conn = await db.open("testdb");
    const result = await conn.rename("site4", "social1");
    conn.close();
    db
      .__data("testdb")
      .find(x => x.key === "social1")
      .value.should.equal("https://www.twitter.com");
  });

  it(`Fails to rename a missing key`, async () => {
    let ex;

    try {
      const conn = await db.open("testdb");
      const result = await conn.rename("site69", "social1");
      conn.close();
    } catch (_ex) {
      ex = _ex;
    }

    ex.message.should.equal("The key site69 was not found.");
  });

  it(`Sets a value`, async () => {
    const conn = await db.open("testdb");
    await conn.set("site5", "https://www.looptype.com");
    conn.close();

    db
      .__data("testdb")
      .find(x => x.key === "site5")
      .value.should.equal("https://www.looptype.com");
  });

  it(`Replaces a value`, async () => {
    const conn = await db.open("testdb");
    await conn.set("site4", "https://www.looptype.com");
    conn.close();

    db
      .__data("testdb")
      .find(x => x.key === "site4")
      .value.should.equal("https://www.looptype.com");
  });

  it(`Executes a transaction`, async () => {
    const conn = await db.open("testdb");

    const multi = await conn.multi();
    await multi.set("site4", "https://www.looptype.com");
    await multi.incr("total");
    await multi.incr("total");
    const result = await conn.exec();

    result.should.deepEqual(['OK', 1001, 1002]);
    
    db
      .__data("testdb")
      .find(x => x.key === "site4")
      .value.should.equal("https://www.looptype.com");
  });

  it(`Rolls back a failed transaction`, async () => {
    const conn = await db.open("testdb");

    const multi = await conn.multi();
    await multi.set("site4", "https://www.looptype.com");
    await multi.incr("total1");
    const result = await conn.exec();

    db
      .__data("testdb")
      .find(x => x.key === "site4")
      .value.should.equal("https://www.twitter.com");
  });

  it(`Gets a value`, async () => {
    const conn = await db.open("testdb");
    const result = await conn.get("site4");
    conn.close();
    result.should.equal("https://www.twitter.com");
  });

  it(`Fails to get a value if it's an array`, async () => {
    let ex;

    try {
      const conn = await db.open("testdb");
      const result = await conn.get("countries");
      conn.close();
    } catch (_ex) {
      ex = _ex;
    }

    ex.message.should.equal(
      "The typeof value with key countries is array. Cannot use get."
    );
  });

  it(`Fails to get a value if it's an object`, async () => {
    let ex;

    try {
      const conn = await db.open("testdb");
      const result = await conn.get("user:99");
      conn.close();
    } catch (_ex) {
      ex = _ex;
    }

    ex.message.should.equal(
      "The typeof value with key user:99 is object. Cannot use get."
    );
  });

  it(`Increment a value by one`, async () => {
    const conn = await db.open("testdb");
    const result = await conn.incr("total");
    conn.close();

    result.should.equal(1001);
    db
      .__data("testdb")
      .find(x => x.key === "total")
      .value.should.equal(1001);
  });

  it(`Increment a value by N`, async () => {
    const conn = await db.open("testdb");
    const result = await conn.incrby("total", 10);
    conn.close();

    result.should.equal(1010);
    db
      .__data("testdb")
      .find(x => x.key === "total")
      .value.should.equal(1010);
  });

  it(`Increment a value by Float N`, async () => {
    const conn = await db.open("testdb");
    const result = await conn.incrbyfloat("total", 10.45);
    conn.close();

    result.should.equal(1010.45);
    db
      .__data("testdb")
      .find(x => x.key === "total")
      .value.should.equal(1010.45);
  });

  it(`Fails to increment missing item`, async () => {
    let ex;

    try {
      const conn = await db.open("testdb");
      const result = await conn.incr("total1");
      conn.close();
    } catch (_ex) {
      ex = _ex;
    }

    ex.message.should.equal("The key total1 was not found.");
  });

  it(`Fails to increment if item is not a number`, async () => {
    let ex;

    try {
      const conn = await db.open("testdb");
      const result = await conn.incr("site1");
      conn.close();
    } catch (_ex) {
      ex = _ex;
    }

    ex.message.should.equal("The key site1 does not hold a number.");
  });

  it(`Decrement a value by one`, async () => {
    const conn = await db.open("testdb");
    const result = await conn.decr("total");
    conn.close();

    result.should.equal(999);
    db
      .__data("testdb")
      .find(x => x.key === "total")
      .value.should.equal(999);
  });

  it(`Decrement a value by N`, async () => {
    const conn = await db.open("testdb");
    const result = await conn.decrby("total", 10);
    conn.close();

    result.should.equal(990);
    db
      .__data("testdb")
      .find(x => x.key === "total")
      .value.should.equal(990);
  });

  it(`Gets the length of a string`, async () => {
    const conn = await db.open("testdb");
    const length = await conn.strlen("user1");
    conn.close();
    length.should.equal(6);
  });

  it(`Fails to get length of a string if item is missing`, async () => {
    let ex;

    try {
      const conn = await db.open("testdb");
      const length = await conn.strlen("doesnotexist");
      conn.close();
    } catch (_ex) {
      ex = _ex;
    }

    ex.message.should.equal("The key doesnotexist was not found.");
  });

  it(`Fails to get length of a string if item is not a string or number`, async () => {
    let ex;

    try {
      const conn = await db.open("testdb");
      const length = await conn.strlen("countries");
      conn.close();
    } catch (_ex) {
      ex = _ex;
    }

    ex.message.should.equal(
      "The value with key countries is not a string or number."
    );
  });

  it(`Remove a value`, async () => {
    const conn = await db.open("testdb");
    await conn.del("site4");
    conn.close();
    db
      .__data("testdb")
      .filter(x => x.key === "site4")
      .should.be.empty();
  });

  it(`Sets a value with expiry`, async () => {
    const conn = await db.open("testdb");
    await conn.set("site5", "https://www.looptype.com", 10);
    conn.close();

    const now = Date.now();
    db
      .__data("testdb")
      .find(x => x.key === "site5")
      .value.should.equal("https://www.looptype.com");
    db
      .__data("testdb")
      .find(x => x.key === "site5")
      .expiry.should.be.lessThan(now + 11000);
  });

  it(`Sets an expiry`, async () => {
    const conn = await db.open("testdb");
    await conn.expire("site1", 10);
    conn.close();

    const now = Date.now();
    db
      .__data("testdb")
      .find(x => x.key === "site1")
      .expiry.should.be.lessThan(now + 11000);
  });

  it(`Creates a list`, async () => {
    const conn = await db.open("testdb");
    const result = await conn.rpush("fruits", ["apple", "mango", "pear"]);
    conn.close();
    result.should.equal(3);
    db
      .__data("testdb")
      .find(x => x.key === "fruits")
      .value.should.deepEqual(["apple", "mango", "pear"]);
  });

  it(`Pushes items to an existing list`, async () => {
    const conn = await db.open("testdb");
    const result = await conn.rpush("countries", ["bulgaria", "sweden"]);
    conn.close();
    result.should.equal(5);
    db
      .__data("testdb")
      .find(x => x.key === "countries")
      .value.should.deepEqual([
        "vietnam",
        "france",
        "belgium",
        "bulgaria",
        "sweden"
      ]);
  });

  it(`Fails to push on non-list`, async () => {
    let ex;

    try {
      const conn = await db.open("testdb");
      const result = await conn.rpush("user1", ["bulgaria", "sweden"]);
      conn.close();
    } catch (_ex) {
      ex = _ex;
    }

    ex.message.should.equal("The value with key user1 is not an array.");
  });

  it(`Prepend items to a list`, async () => {
    const conn = await db.open("testdb");
    await conn.lpush("countries", ["bulgaria", "sweden"]);
    conn.close();
    db
      .__data("testdb")
      .find(x => x.key === "countries")
      .value.should.deepEqual([
        "bulgaria",
        "sweden",
        "vietnam",
        "france",
        "belgium"
      ]);
  });

  it(`Fails to prepend on non-list`, async () => {
    let ex;

    try {
      const conn = await db.open("testdb");
      await conn.lpush("user1", ["bulgaria", "sweden"]);
      conn.close();
    } catch (_ex) {
      ex = _ex;
    }

    ex.message.should.equal("The value with key user1 is not an array.");
  });

  it(`Gets an item at index`, async () => {
    const conn = await db.open("testdb");
    const result = await conn.lindex("countries", 1);
    conn.close();
    result.should.deepEqual("france");
  });

  it(`Fails to get an item at index on non-list`, async () => {
    let ex;

    try {
      const conn = await db.open("testdb");
      const result = await conn.lindex("user1", 1);
      conn.close();
    } catch (_ex) {
      ex = _ex;
    }

    ex.message.should.equal("The value with key user1 is not an array.");
  });

  it(`Sets an item at index`, async () => {
    const conn = await db.open("testdb");
    const result = await conn.lset("countries", 1, "thailand");
    conn.close();
    db
      .__data("testdb")
      .find(x => x.key === "countries")
      .value.should.deepEqual(["vietnam", "thailand", "belgium"]);
  });

  it(`Fails to set an item at index on non-list`, async () => {
    let ex;

    try {
      const conn = await db.open("testdb");
      const result = await conn.lset("user1", 1, "thailand");
      conn.close();
    } catch (_ex) {
      ex = _ex;
    }

    ex.message.should.equal("The value with key user1 is not an array.");
  });

  it(`Gets a list`, async () => {
    const conn = await db.open("testdb");
    const result = await conn.lrange("countries");
    conn.close();
    result.should.deepEqual(["vietnam", "france", "belgium"]);
  });

  it(`Fails to get a non-list`, async () => {
    let ex;

    try {
      const conn = await db.open("testdb");
      const result = await conn.lrange("user1");
      conn.close();
    } catch (_ex) {
      ex = _ex;
    }

    ex.message.should.equal("The value with key user1 is not an array.");
  });

  it(`Gets a list range`, async () => {
    const conn = await db.open("testdb");
    const result = await conn.lrange("countries", 1, 2);
    conn.close();
    result.should.deepEqual(["france", "belgium"]);
  });

  it(`Fails to get a range on non-list`, async () => {
    let ex;

    try {
      const conn = await db.open("testdb");
      const result = await conn.lrange("user1", 1, 2);
      conn.close();
    } catch (_ex) {
      ex = _ex;
    }

    ex.message.should.equal("The value with key user1 is not an array.");
  });

  it(`Removes from a list`, async () => {
    const conn = await db.open("testdb");
    const result = await conn.lrem("countries", "belgium");
    conn.close();
    db
      .__data("testdb")
      .find(x => x.key === "countries")
      .value.should.deepEqual(["vietnam", "france"]);
  });

  it(`Fails to remove an item on non-list`, async () => {
    let ex;

    try {
      const conn = await db.open("testdb");
      const result = await conn.lrem("user1", "belgium");
      conn.close();
    } catch (_ex) {
      ex = _ex;
    }

    ex.message.should.equal("The value with key user1 is not an array.");
  });

  it(`Trims a list`, async () => {
    const conn = await db.open("testdb");
    const result = await conn.ltrim("countries", 1, 2);
    conn.close();
    db
      .__data("testdb")
      .find(x => x.key === "countries")
      .value.should.deepEqual(["france", "belgium"]);
  });

  it(`Fails to trim on non-list`, async () => {
    let ex;

    try {
      const conn = await db.open("testdb");
      const result = await conn.ltrim("user1", 1, 2);
      conn.close();
    } catch (_ex) {
      ex = _ex;
    }

    ex.message.should.equal("The value with key user1 is not an array.");
  });

  it(`Gets the length of a list`, async () => {
    const conn = await db.open("testdb");
    const result = await conn.llen("countries");
    conn.close();
    result.should.equal(3);
  });

  it(`Fails to get the length of non-list`, async () => {
    let ex;

    try {
      const conn = await db.open("testdb");
      const result = await conn.llen("user1");
      conn.close();
    } catch (_ex) {
      ex = _ex;
    }

    ex.message.should.equal("The value with key user1 is not an array.");
  });

  it(`Creates a hash`, async () => {
    const conn = await db.open("testdb");
    await conn.hmset("user:100", {
      username: "jeswin",
      country: "India",
      verified: 1
    });
    conn.close();
    db
      .__data("testdb")
      .find(x => x.key === "user:100")
      .value.should.deepEqual({
        username: "jeswin",
        country: "India",
        verified: 1
      });
  });

  it(`Merges into an existing hash`, async () => {
    const conn = await db.open("testdb");
    await conn.hmset("user:99", { city: "Bombay", blocked: 1 });
    conn.close();

    db
      .__data("testdb")
      .find(x => x.key === "user:99")
      .value.should.deepEqual({
        username: "janie",
        country: "India",
        city: "Bombay",
        blocked: 1,
        verified: 1
      });
  });

  it(`Fails to set fields in hash if item is a non-hash`, async () => {
    let ex;

    try {
      const conn = await db.open("testdb");
      await conn.hmset("user1", {
        username: "jeswin",
        country: "India",
        verified: 1
      });
      conn.close();
    } catch (_ex) {
      ex = _ex;
    }

    ex.message.should.equal("The value with key user1 is not an object.");
  });

  it(`Creates a hash with a single field`, async () => {
    const conn = await db.open("testdb");
    await conn.hset("user:99", "city", "Bombay");
    conn.close();

    db
      .__data("testdb")
      .find(x => x.key === "user:99")
      .value.should.deepEqual({
        username: "janie",
        country: "India",
        city: "Bombay",
        verified: 1
      });
  });

  it(`Reads fields of a hash`, async () => {
    const conn = await db.open("testdb");
    const result = await conn.hmget("user:99", ["username", "verified"]);
    conn.close();

    result.should.deepEqual({ username: "janie", verified: 1 });
  });

  it(`Fails to read fields from a non-hash`, async () => {
    let ex;

    try {
      const conn = await db.open("testdb");
      const result = await conn.hmget("user1", ["username", "verified"]);
      conn.close();
    } catch (_ex) {
      ex = _ex;
    }

    ex.message.should.equal("The value with key user1 is not an object.");
  });

  it(`Reads a single field from a hash`, async () => {
    const conn = await db.open("testdb");
    const result = await conn.hget("user:99", "username");
    conn.close();
    result.should.equal("janie");
  });

  it(`Fails to read single field from a non-hash`, async () => {
    let ex;

    try {
      const conn = await db.open("testdb");
      const result = await conn.hget("user1", "username");
      conn.close();
    } catch (_ex) {
      ex = _ex;
    }

    ex.message.should.equal("The value with key user1 is not an object.");
  });

  it(`Reads all fields of a hash`, async () => {
    const conn = await db.open("testdb");
    const result = await conn.hgetall("user:99");
    conn.close();
    result.should.deepEqual({
      username: "janie",
      country: "India",
      verified: 1
    });
  });

  it(`Fails to read all fields of a non-hash`, async () => {
    let ex;

    try {
      const conn = await db.open("testdb");
      const result = await conn.hgetall("user1");
      conn.close();
    } catch (_ex) {
      ex = _ex;
    }

    ex.message.should.equal("The value with key user1 is not an object.");
  });

  it(`Increments a field in a hash by N`, async () => {
    const conn = await db.open("testdb");
    const result = await conn.hincrby("user:99", "verified", 2);
    conn.close();
    result.should.equal(3);
  });

  it(`Increments a field in a hash by float N`, async () => {
    const conn = await db.open("testdb");
    const result = await conn.hincrbyfloat("user:99", "verified", 2.5);
    conn.close();
    result.should.equal(3.5);
  });

  it(`Scans keys`, async () => {
    const conn = await db.open("testdb");
    const result1 = await conn.scan(0, "*", 3);
    const result2 = await conn.scan(1, "*", 3);
    conn.close();
    result1.should.deepEqual([2, ["site1", "site2", "site3"]]);
    result2.should.deepEqual([3, ["site4", "user1", "user2"]]);
  });

  it(`Scans a set of keys with pattern`, async () => {
    const conn = await db.open("testdb");
    const result1 = await conn.scan(0, "site*");
    conn.close();
    result1.should.deepEqual([0, ["site1", "site2", "site3", "site4"]]);
  });

  it(`Scans a set of keys with pattern and count`, async () => {
    const conn = await db.open("testdb");
    const result1 = await conn.scan(0, "site*", 3);
    const result2 = await conn.scan(1, "site*", 3);
    conn.close();
    result1.should.deepEqual([2, ["site1", "site2", "site3"]]);
    result2.should.deepEqual([0, ["site4"]]);
  });

  it(`Scans a set of keys with pattern and large count`, async () => {
    const conn = await db.open("testdb");
    const result1 = await conn.scan(0, "site*", 1000);
    conn.close();
    result1.should.deepEqual([0, ["site1", "site2", "site3", "site4"]]);
  });
});
