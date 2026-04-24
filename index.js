const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const sendEmail = require("./ulits/sendEmail");
const app = express();
const port = process.env.PORT || 5000;

// middlewere
app.use(express.json());
app.use(cors());

const uri = `mongodb+srv://${process.env.USER_DB}:${process.env.PASSWORD_DB}@cluster0.oibnujx.mongodb.net/?appName=Cluster0`;
console.log(process.env.USER_DB, process.env.PASSWORD_DB);

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const db = client.db("mk-sports");
    const tuitionsCollection = db.collection("product");
    const reviewsCollection = db.collection("reviews");
    const ordersCollection = db.collection("orders");
    const contactCollection = db.collection("contact");
    const userColl = db.collection("users");
    const heroPhoto = db.collection("photo");

    // customer riveews
    app.post("/photos", async (req, res) => {
      const photo = req.body;
      const result = await heroPhoto.insertOne(photo);
      res.send(result);
    });

    // GET all photos
    app.get("/photos", async (req, res) => {
      const heroPhoto = db.collection("photo");
      const photos = await heroPhoto.find({}).toArray();
      res.send(photos);
    });

    // delete photo
    app.delete("/photos/:id", async (req, res) => {
      const { id } = req.params; // <-- change _id to id

      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ success: false, message: "Invalid ID" });
      }

      try {
        const result = await heroPhoto.deleteOne({
          _id: new ObjectId(id),
        });
        if (result.deletedCount === 0) {
          return res
            .status(404)
            .send({ success: false, message: "Photo not found" });
        }
        res.send({ success: true, message: "Photo deleted successfully" });
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .send({ success: false, message: "Failed to delete photo" });
      }
    });

    // user related api

    app.get("/users", async (req, res) => {
      const cursor = userColl.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      user.role = "user";
      user.createdAt = new Date();
      const email = user.email;
      const userExists = await userColl.findOne({ email });
      if (userExists) {
        return res.send({ message: "user exists" });
      }
      const result = await userColl.insertOne(user);
      res.send(result);
    });

    app.get("/users/:email/role", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await userColl.findOne(query);
      res.send({ role: user?.role || "user" });
    });

    // Make user an admin
    app.patch("/users/:id/admin", async (req, res) => {
      const { id } = req.params;
      const result = await userColl.updateOne(
        { _id: new ObjectId(id) },
        { $set: { role: "admin" } },
      );
      res.send(result);
    });
    // remove admin
    app.patch("/users/:id/remove-admin", async (req, res) => {
      const { id } = req.params;
      const result = await userColl.updateOne(
        { _id: new ObjectId(id) },
        { $set: { role: "user" } },
      );
      res.send(result);
    });

    // product post
    app.post("/tuitions", async (req, res) => {
      const tuitionData = req.body;
      const result = await tuitionsCollection.insertOne(tuitionData);
      // Role update only if user doesn't exist or doesn't have a role yet
      const user = await userColl.findOne({ email: tuitionData.studentEmail });
      if (user && !user.role) {
        await userColl.updateOne(
          { email: tuitionData.studentEmail },
          { $set: { role: "student", updatedAt: new Date() } },
        );
      }
      res.send(result);
    });

    // tuition
    app.get("/tuitions", async (req, res) => {
      try {
        const tuitions = await tuitionsCollection
          .find({})
          .sort({ postedAt: -1 })
          .toArray();
        res.send(tuitions);
      } catch (error) {
        res.status(500).send({ message: "Error fetching tuitions" });
      }
    });

    app.get("/allimage", async (req, res) => {
      try {
        const tuitions = await tuitionsCollection.find({}).toArray();
        res.send(tuitions);
      } catch (error) {
        res.status(500).send({ message: "Error fetching tuitions" });
      }
    });

    // get all product
    app.get("/dashboard/all-products", async (req, res) => {
      try {
        const totalProducts = await tuitionsCollection.countDocuments(); // total products
        res.send({
          totalProducts: totalProducts || 0, // default 0
        });
      } catch (err) {
        console.error(err);
        res.status(500).send({ totalProducts: 0 });
      }
    });

    // get all users
    app.get("/dashboard/all-users", async (req, res) => {
      try {
        const totalUsers = await userColl.countDocuments(); // total users
        res.send({
          totalUsers: totalUsers || 0, // default 0
        });
      } catch (err) {
        console.error(err);
        res.status(500).send({ totalUsers: 0 });
      }
    });

    // pagination

    app.get("/tuitions-pagination", async (req, res) => {
      try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 6;
        const skip = (page - 1) * limit;
        const status = req.query.status || "Approved";

        let query = { status: status };

        if (req.query.category) {
          query.category = { $regex: req.query.category, $options: "i" };
        }
        if (req.query.location) {
          query.location = { $regex: req.query.location, $options: "i" };
        }

        // Sort option
        let sortOption = { postedAt: -1 };

        if (req.query.sort === "budget-high") {
          sortOption = { price: -1 };
        } else if (req.query.sort === "budget-low") {
          sortOption = { price: 1 };
        }

        const tuitions = await tuitionsCollection
          .find(query)
          .skip(skip)
          .limit(limit)
          .sort(sortOption)
          .toArray();

        const totalTuitions = await tuitionsCollection.countDocuments(query);

        res.json({
          tuitions,
          totalPages: Math.ceil(totalTuitions / limit),
          currentPage: page,
          totalTuitions,
        });
      } catch (error) {
        console.error("Error in /tuitions:", error);
        res.status(500).json({ message: "Server error", error: error.message });
      }
    });

    // tuition details page
    app.get("/tuitions/:id", async (req, res) => {
      const { id } = req.params;
      const tuition = await tuitionsCollection.findOne({
        _id: new ObjectId(id),
      });

      if (!tuition)
        return res.status(404).send({ message: "Tuition not found" });

      res.send(tuition);
    });

    // category sweets
    app.get("/products", async (req, res) => {
      const category = req.query.category;

      const query = category
        ? { category: { $regex: `^${category}$`, $options: "i" } }
        : {};
      const result = await tuitionsCollection.find(query).toArray();

      res.send(result);
    });

    // customer riveews
    app.post("/reviews", async (req, res) => {
      const review = req.body;
      const result = await reviewsCollection.insertOne(review);
      res.send(result);
    });

    // GET all reviews
    app.get("/reviews", async (req, res) => {
      const reviewsCollection = db.collection("reviews");
      const reviews = await reviewsCollection.find({}).toArray();
      res.send(reviews);
    });

    // backend/orders route in your main server file

    app.post("/orders", async (req, res) => {
      const order = req.body;

      try {
        const result = await ordersCollection.insertOne({
          ...order,
          createdAt: new Date(),
        });

        // send email (try/catch inside sendEmail alread)
        await sendEmail(order);

        res.send({ success: true, data: result });
      } catch (err) {
        console.error(err);
        res
          .status(500)
          .send({ success: false, message: "Order creation failed" });
      }
    });

    // order get
    app.get("/orders", async (req, res) => {
      const result = await ordersCollection
        .find()
        .sort({ createdAt: -1 }) // 🔥 latest first
        .toArray();

      res.send(result);
    });

    // customer order get
    app.get("/orders-customer", async (req, res) => {
      const email = req.query.email;
      if (!email) {
        return res
          .status(400)
          .send({ message: "Email query parameter is required" });
      }
      const result = await ordersCollection
        .find({ email: email })
        .sort({ createdAt: -1 }) // 🔥 latest first
        .toArray();
      res.send(result);
    });

    // customer contact
    app.post("/contact", async (req, res) => {
      const contact = req.body;
      const result = await contactCollection.insertOne(contact);
      res.send(result);
    });

    app.get("/contact", async (req, res) => {
      const result = await contactCollection
        .find()
        .sort({ createdAt: -1 }) // 🔥 latest first
        .toArray();

      res.send(result);
    });

    app.delete("/contact/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await contactCollection.deleteOne(query);
      res.send(result);
    });

    // update order status
    app.patch("/orders/:id", async (req, res) => {
      const { id } = req.params;
      const { status } = req.body;

      const result = await ordersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status } },
      );
      res.send(result);
    });

    // delete order
    app.delete("/orders/:id", async (req, res) => {
      const id = req.params.id;

      try {
        const query = { _id: new ObjectId(id) };

        const result = await ordersCollection.deleteOne(query);

        if (result.deletedCount === 1) {
          res.send({
            success: true,
            message: "Order deleted successfully",
          });
        } else {
          res.status(404).send({
            success: false,
            message: "Order not found",
          });
        }
      } catch (error) {
        console.error(error);
        res.status(500).send({
          success: false,
          message: "Failed to delete order",
        });
      }
    });

    // update

    app.put("/tuitions/:id", async (req, res) => {
      const { id } = req.params;
      const updatedData = req.body;
      try {
        const result = await tuitionsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedData },
        );
        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "Tuition not found" });
        }
        res.send({ success: true, modifiedCount: result.modifiedCount });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server error", error: err.message });
      }
    });

    // DELETE a tuition by ID
    app.delete("/tuitions/:id", async (req, res) => {
      try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res
            .status(400)
            .send({ success: false, message: "Invalid ID" });
        }
        const result = await tuitionsCollection.deleteOne({
          _id: new ObjectId(id),
        });
        if (result.deletedCount === 0) {
          return res
            .status(404)
            .send({ success: false, message: "Tutor not found" });
        }
        res.send({ success: true, deletedCount: result.deletedCount });
      } catch (err) {
        console.error(err);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });

    // Approve
    app.patch("/tuitions/:id/approve", async (req, res) => {
      const { id } = req.params;
      const { email } = req.body;
      const user = await userColl.findOne({ email });
      if (!user || user.role !== "admin")
        return res.status(403).send({ success: false, message: "Admin only" });

      const result = await tuitionsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: "Approved", approvedAt: new Date() } },
      );

      res.send({ success: result.modifiedCount > 0 });
    });

    // Reject
    app.patch("/tuitions/:id/reject", async (req, res) => {
      const { id } = req.params;
      const { email } = req.body;
      const user = await userColl.findOne({ email });
      if (!user || user.role !== "admin")
        return res.status(403).send({ success: false, message: "Admin only" });

      const result = await tuitionsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: "Rejected" } },
      );

      res.send({ success: result.modifiedCount > 0 });
    });

    // email get

    app.get("/tuitions-get", async (req, res) => {
      const { email } = req.query;
      let query = {};
      if (email) {
        query.studentEmail = email;
      }
      const result = await tuitionsCollection
        .find(query)
        .sort({ postedAt: -1 })
        .toArray();
      res.send(result);
    });

    // email get
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("mk-sports Backend is running");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
