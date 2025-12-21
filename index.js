const express = require('express');
const cors = require('cors');
require('dotenv').config()
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: "http://localhost:5173", // frontend url
    credentials: true,
  })
);
app.use(express.json())
app.use(cookieParser());

// JWT Verify
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).send({ message: "Unauthorized access" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorized access" });
    }

    req.decoded = decoded; // save email
    next();
  });
};

// MongoDB
const uri = process.env.MONGO_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
})


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
  
  
//  verify admin
const verifyAdmin = async (req, res, next) => {
  
  const email = req.decoded.email;

  const user = await usersCollection.findOne({ email });

  if (!user || user.role !== "admin") {
    return res.status(403).send({ message: "Forbidden access" });
  }
  next();
};

// verify manager middleware
const verifyManager = async (req, res, next) => {
  try {
    const email = req.decoded.email;

    const user = await usersCollection.findOne({ email });

    if (!user || user.role !== "manager") {
      return res.status(403).send({ message: "Forbidden access: Manager only" });
    }

    next();
  } catch (error) {
    res.status(500).send({ message: "Manager verification failed" });
  }
};

  
// create JWT
app.post("/jwt", (req, res) => {
  const user = req.body;

  const token = jwt.sign(
    { email: user.email }, 
    process.env.JWT_SECRET, 
    { expiresIn: "1d" }
  );

  res.cookie("token", token, {
      httpOnly: true,
      secure: false, 
      sameSite: "lax",
    })
    .send({ success: true });
});

// Register >> Save User

app.post("/users", async (req, res) => {
      const { name, email } = req.body;

      const exists = await usersCollection.findOne({ email });
      if (exists) return res.send({ message: "User already exists" });

      const userDoc = {
        name,
        email,
        role: "buyer",
        status: "pending",
        createdAt: new Date(),
      };

      const result = await usersCollection.insertOne(userDoc);
      res.send(result);
    });

  
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


// Get orders My Orders page (buyer)
app.get("/orders/:email", async (req, res) => {
  try {
    const email = req.params.email;
    const orders = await ordersCollection.find({ email }).toArray();
    res.send(orders);
  } catch (err) {
    console.error("Error fetching user orders:", err);
    res.status(500).send({ message: "Failed to fetch orders" });
  }
});


//const verifyJWT = require("./middlewares/verifyJWT");
// Get all users (for admin dashboard)


app.get("/users",
  verifyToken, 
  verifyAdmin, 
  async (req, res) => {
  try {
    const users = await usersCollection
    .find()
    .sort({ createdAt: -1 })
    .toArray();
    res.send(users);
  } 
  catch (error) {
    res.status(500).send({ message: "Failed to fetch users" });
  }
});


// user id (for admin)
app.patch("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { role, status, suspendReason, suspendFeedback } = req.body;

  const updateDoc = {
    role,
    status,
    updatedAt: new Date(),
  };

  // if (role) updateDoc.role = role;
  // updateDoc.status = status;

  if (status === "suspended") {
    updateDoc.suspendReason = suspendReason || "";
    updateDoc.suspendFeedback = suspendFeedback || "";
  }
  else {
    updateDoc.suspendReason = "";
    updateDoc.suspendFeedback = "";
  }

  const result = await usersCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: updateDoc }
  );

  res.send(result);
});


// show on home toggle
app.patch(
  "/productsData/showHome/:id",
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    const { id } = req.params;
    const { showOnHome } = req.body;

    const result = await productsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { showOnHome } }
    );

    res.send(result);
  }
);

// get order (for admin)
app.get("/orders", verifyToken, verifyAdmin, async (req, res) => {
  const { status } = req.query;

  let query = {};
  if (status) {
    query.status = status; // Pending / Approved / Rejected
  }

  const orders = await ordersCollection.find(query).toArray();
  res.send(orders);
});


// order id (for admin)

app.get("/orders/:id", verifyToken, verifyAdmin, async (req, res) => {
  const { id } = req.params;

  const order = await ordersCollection.findOne({
    _id: new ObjectId(id),
  });

  if (!order) {
    return res.status(404).send({ message: "Order not found" });
  }

  res.send(order);
});


// add product (manager)

app.post("/productsData", verifyToken, verifyManager, async (req, res) => {
  const product = req.body;

  product.createdAt = new Date();

  const result = await productsCollection.insertOne(product);
  res.send(result);
});


//for update product data (admin)
// app.patch("/productsData/:id",
//   verifyToken,
//   verifyAdmin,
//    async (req, res) => {
//   const id = req.params.id;
//   const updateData = req.body;

//   const result = await productsCollection.updateOne(
//     { _id: new ObjectId(id) },
//     { $set: updateData }
//   );

//   res.send(await productsCollection.findOne({ _id: new ObjectId(id) }));
// });
// update product (admin, manager)
app.patch("/productsData/:id", verifyToken, async (req, res) => {
  const email = req.decoded.email;
  const user = await usersCollection.findOne({ email });

  if (!user || (user.role !== "admin" && user.role !== "manager")) {
    return res.status(403).send({ message: "Forbidden access" });
  }

  try {
    const { name, price, category, paymentOptions } = req.body;

    const updateData = {
      name,
      price,
      category,
      paymentOptions: paymentOptions ? [paymentOptions] : [], 
    };

    const result = await productsCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: updateData }
    );

    const updatedProduct = await productsCollection.findOne({ _id: new ObjectId(req.params.id) });

    if (!updatedProduct) {
      return res.status(404).send({ success: false, message: "Product not found" });
    }

    res.send(updatedProduct);
  } catch (err) {
    console.error(err);
    return res.status(500).send({ success: false, message: "Update failed" });
  }
});





//delete product (admin, manager)
app.delete("/productsData/:id", verifyToken, async (req, res) => {
  const email = req.decoded.email;
  const user = await usersCollection.findOne({ email });

  if (!user || (user.role !== "admin" && user.role !== "manager")) {
    return res.status(403).send({ message: "Forbidden access" });
  }

  try {
    const result = await productsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
    if (result.deletedCount > 0) {
      return res.send({ success: true, deletedCount: result.deletedCount });
    } else {
      return res.status(404).send({ success: false, message: "Product not found" });
    }
  } catch (err) {
    return res.status(500).send({ success: false, message: "Delete failed" });
  }
});


// get products (for manager---manage products page)
app.get("/productsData/manager", async (req, res) => {
  try {
    const products = await productsCollection
      .find({ createdBy: "Manager" })
      .toArray();

    res.send(products);
  } catch (error) {
    //console.error("Manager products error:", error);
    res.status(500).send({ message: "Failed to load products" });
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