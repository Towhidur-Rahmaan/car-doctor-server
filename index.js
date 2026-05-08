const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

/* =========================================
   CORS CONFIG
========================================= */

const allowedOrigins = [
  "http://localhost:5173",
  "https://car-doctor-11635.web.app",
  "https://car-doctor-11635.firebaseapp.com",
];

const corsOptions = {
  origin: function (origin, callback) {
    console.log("Origin:", origin);

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("CORS Not Allowed"));
    }
  },

  credentials: true,

  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));

app.options(/.*/, cors(corsOptions));

app.use(express.json());

app.use(cookieParser());

/* =========================================
   MONGODB
========================================= */

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1rhitkk.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

/* =========================================
   LOGGER
========================================= */

const logger = (req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
};

/* =========================================
   VERIFY TOKEN
========================================= */

const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token;

  console.log("TOKEN:", token);

  if (!token) {
    return res.status(401).send({
      success: false,
      message: "Unauthorized Access",
    });
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({
        success: false,
        message: "Invalid Token",
      });
    }

    req.user = decoded;

    next();
  });
};

/* =========================================
   DATABASE FUNCTION
========================================= */

async function run() {
  try {
    await client.connect();

    console.log("MongoDB Connected");

    const serviceCollection = client.db("carDoctor").collection("services");

    const bookingCollection = client.db("carDoctor").collection("bookings");

    const usersCollection = client.db("carDoctor").collection("users");

    const reviewCollection = client.db("carDoctor").collection("reviews");

    /* =========================================
       TEST ROUTE
    ========================================= */

    app.get("/test", (req, res) => {
      res.send({
        success: true,
        message: "Backend Working",
      });
    });

    /* =========================================
       JWT
    ========================================= */

    app.post("/jwt", logger, async (req, res) => {
      const user = req.body;

      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "7d",
      });

      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({
          success: true,
        });
    });

    app.post("/logout", logger, async (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({
          success: true,
        });
    });

    /* =========================================
       USERS
    ========================================= */

    app.post("/users", async (req, res) => {
      const user = req.body;

      const existingUser = await usersCollection.findOne({
        email: user.email,
      });

      if (existingUser) {
        return res.send({
          message: "User already exists",
          inserted: false,
        });
      }

      const result = await usersCollection.insertOne(user);

      res.send(result);
    });

    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;

      const user = await usersCollection.findOne({ email });

      res.send({
        admin: user?.role === "admin",
      });
    });

    /* =========================================
       SERVICES
    ========================================= */

    app.get("/services", logger, async (req, res) => {
      const result = await serviceCollection.find().toArray();

      console.log("Services Sent:", result.length);

      res.send(result);
    });

    app.get("/services/:id", async (req, res) => {
      const id = req.params.id;

      const result = await serviceCollection.findOne({
        _id: new ObjectId(id),
      });

      res.send(result);
    });

    app.post("/services", async (req, res) => {
      const service = req.body;

      const result = await serviceCollection.insertOne(service);

      res.send(result);
    });

    app.delete("/services/:id", async (req, res) => {
      const id = req.params.id;

      const result = await serviceCollection.deleteOne({
        _id: new ObjectId(id),
      });

      res.send(result);
    });

    /* =========================================
       REVIEWS
    ========================================= */

    app.post("/reviews", async (req, res) => {
      const review = req.body;

      const result = await reviewCollection.insertOne(review);

      res.send(result);
    });

    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find().sort({ _id: -1 }).toArray();

      res.send(result);
    });

    app.delete("/reviews/:id", async (req, res) => {
      const id = req.params.id;

      const result = await reviewCollection.deleteOne({
        _id: new ObjectId(id),
      });

      res.send(result);
    });

    /* =========================================
       BOOKINGS
    ========================================= */

    app.get("/bookings", logger, verifyToken, async (req, res) => {
      if (req.user.email !== req.query.email) {
        return res.status(403).send({
          message: "Forbidden Access",
        });
      }

      const result = await bookingCollection
        .find({
          email: req.query.email,
        })
        .toArray();

      res.send(result);
    });

    app.get("/allBookings", async (req, res) => {
      const result = await bookingCollection.find().toArray();

      res.send(result);
    });

    app.get("/admin/bookings", async (req, res) => {
      const result = await bookingCollection.find().toArray();

      res.send(result);
    });

    app.post("/bookings", async (req, res) => {
      const booking = req.body;

      const result = await bookingCollection.insertOne(booking);

      res.send(result);
    });

    app.patch("/bookings/:id", async (req, res) => {
      const id = req.params.id;

      const result = await bookingCollection.updateOne(
        {
          _id: new ObjectId(id),
        },
        {
          $set: {
            status: req.body.status,
          },
        },
      );

      res.send(result);
    });

    app.patch("/admin/bookings/status/:id", async (req, res) => {
      const id = req.params.id;

      const result = await bookingCollection.updateOne(
        {
          _id: new ObjectId(id),
        },
        {
          $set: {
            status: req.body.status,
          },
        },
      );

      res.send(result);
    });

    app.delete("/bookings/:id", async (req, res) => {
      const id = req.params.id;

      const result = await bookingCollection.deleteOne({
        _id: new ObjectId(id),
      });

      res.send(result);
    });

    /* =========================================
       ADMIN STATS
    ========================================= */

    app.get("/admin-stats", async (req, res) => {
      const services = await serviceCollection.estimatedDocumentCount();

      const bookings = await bookingCollection.estimatedDocumentCount();

      const users = await usersCollection.estimatedDocumentCount();

      const bookingData = await bookingCollection.find().toArray();

      const revenue = bookingData.reduce(
        (sum, item) => sum + parseFloat(item.price),
        0,
      );

      const pending = bookingData.filter(
        (item) => item.status !== "confirm",
      ).length;

      const confirmed = bookingData.filter(
        (item) => item.status === "confirm",
      ).length;

      res.send({
        services,
        bookings,
        users,
        revenue,
        pending,
        confirmed,
      });
    });

    /* =========================================
       MONGO PING
    ========================================= */

    await client.db("admin").command({ ping: 1 });

    console.log("MongoDB Ping Success");
  } catch (error) {
    console.log(error);
  }
}

run();

/* =========================================
   ROOT
========================================= */

app.get("/", (req, res) => {
  res.send("Car Doctor Server Running");
});

/* =========================================
   SERVER
========================================= */

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
