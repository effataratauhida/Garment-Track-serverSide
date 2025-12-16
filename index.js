const express = require('express');
const cors = require('cors');
require('dotenv').config()
const port = process.env.PORT || 5000

const app = express();
app.use(cors());
app.use(express.json())
const uri = process.env.MONGO_URI;

const { MongoClient, ServerApiVersion } = require('mongodb');


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");


  const database = client.db("garmenttrack-db");
  const productsCollection = database.collection("productsData");
  const usersCollection = database.collection("users");
  const ordersCollection = database.collection("orders");
  
  // Get all products

  app.get("/productsData", async (req, res) => {
  const products = await productsCollection.find({}).toArray();
  res.send(products);
  });

// get 6 products in home using limit

app.get("/productsData/limit", async (req, res) => {
  try {
    //console.log("Fetching limited products...");
    const products = await productsCollection
      .find({ showOnHome: true }) 
      .limit(6)
      .toArray();
    //console.log("Products fetched:", products);
    res.send(products);
  } catch (err) {
    console.error("Error while fetching limited products:", err);
    res.status(500).send({ message: "Failed to fetch products" });
  }
});


  // Get single product by id  
  const { ObjectId } = require("mongodb");
  app.get("/productsData/:id", async (req, res) => {
    const id = req.params.id;
    const product = await productsCollection.findOne({ _id: new ObjectId(id) });
    if (!product) return res.status(404).send({ message: "Product not found" });
    res.send(product);
    });


    // Register >> Save User
  app.post("/users", async (req, res) => {



    console.log("✅ POST /users HIT");
    console.log("BODY:", req.body);



  try {
    const { name, email, photoURL, role, status } = req.body;

  // validation
  if (!email || !name) {
    return res.status(400).send({ message: "Name & Email required" });
  }

  // Check if already have user
  const existingUser = await usersCollection.findOne({ email });
    if (existingUser) {
    return res.send({ message: "User already exists" });
  }

  // role 
  const allowedRoles = ["buyer", "manager"];
  const finalRole = allowedRoles.includes(role) ? role : "buyer";
  const userDoc = {
    name,
    email,
    photoURL: photoURL || "",
    role: finalRole,
    status: "pending",
    createdAt: new Date(),
  };

  const result = await usersCollection.insertOne(userDoc);
  res.send(result);

  } catch (error) {
    res.status(500).send({ message: "Failed to save user" });
  }
});


// Get single user by email
app.get("/users/:email", async (req, res) => {
  try {
    const email = req.params.email;
    const user = await usersCollection.findOne({ email });
    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }
    res.send(user);
  } catch (err) {
    res.status(500).send({ message: "Failed to fetch user" });
  }
});


// save the new buyers orders/booking

app.post("/orders", async (req, res) => {
  try {
    const orderData = req.body;

    if (
      !orderData.productId ||
      !orderData.email ||
      !orderData.firstName ||
      !orderData.lastName ||
      !orderData.quantity
    ) {
      return res.status(400).send({ message: "Missing required fields" });
    }
// save 

 const result = await ordersCollection.insertOne(orderData);
res.send({
      success: true,
      message: "Order placed successfully",
      insertedId: result.insertedId,
    });
   } catch (err) {
    console.error("Error saving order:", err);
    res.status(500).send({ message: "Failed to save order" });
  }
});


  








  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);


app.get('/',(req,res)=>{
    res.send("Hello this is a server")
})

app.listen(port,()=>{
    console.log(`Server is running on port ${port}`)
})