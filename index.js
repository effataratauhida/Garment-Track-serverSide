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
  
  // Get all products

  app.get("/productsData", async (req, res) => {
  const products = await productsCollection.find({}).toArray();
  res.send(products);
  });


    // Get limited 6 products for Home Page
// app.get("/productsData/limit", async (req, res) => {
//   const products = await productsCollection
//   .find({ showOnHome: true })
//   .limit(6)
//   .toArray();
//   res.send(products);
// });
app.get("/productsData/limit", async (req, res) => {
  try {
    console.log("Fetching limited products...");
    const products = await productsCollection
      .find({ showOnHome: true }) // or "true" if string in DB
      .limit(6)
      .toArray();
    console.log("Products fetched:", products);
    res.send(products);
  } catch (err) {
    console.error("Error fetching limited products:", err);
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