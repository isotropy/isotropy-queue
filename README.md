
First, we need to create a JS file while represents or emulates our database system on the client-side.
Here's how you do that.

```javascript
import db from "isotropy-lib-db";

export default db.create({
  customers: [
    {      
      name: "Jenna Maroney",
      occupation: "Actor"
    },
    {
      name: "Liz Lemon",
      occupation: "Producer"
    }
  ]
})
```

Usage is easy. Start by importing the file you just created.

```javascript
import db from "./my-db";

//Get all records in a table
const customers = await db.table("customers").toArray();

//Insert a record
const id = await db().table("customers").insert({
  name: "Jack Donaghy",
  occupation: "Executive"
});

//Delete a record
const id = await db().table("customers").delete(c => c.name === "Jack Donaghy")

//Insert a bunch of records
const ids = await db().table("customers").insert(arrayOfCustomers);

//Query customers
const customers = await db().table("customers").filter(c => c.occupation === "Actor").toArray()

//Sort a query
const customers = await db().table("customers").filter(c => c.occupation === "Actor").orderBy("name").toArray()

//Sort a query, descending
const customers = await db().table("customers").filter(c => c.occupation === "Actor").orderByDescending("name").toArray()

//Slice a query
const customers = await db().table("customers").filter(c => c.occupation === "Actor").slice(1, 10)

//Fetch only specific fields
const customers = await db().table("customers").filter(c => c.occupation === "Actor").map(c => ({ name: c.name })).toArray()

//Update
await db().table("customers").update(c => c.name === "Kenneth Parcell", { occupation: "Page" })

//Count
const count = await db().table("customers").count();
```

