const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const cors = require("cors");
const mongoose = require("mongoose");

// DB connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .catch(error => console.error(error));

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const Schema = mongoose.Schema;
const userSchema = new Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    maxlength: [25, "Username too long"]
  }
});
const User = mongoose.model("User", userSchema); /* = <Your Model> */
const exerciseSchema = new Schema({
  userId: {
    type: String,
    required: true,
    ref: "userSchema"
  },
  description: {
    type: String,
    required: true,
    maxlength: [20, "Description too long"]
  },
  duration: {
    type: Number,
    required: true,
    min: [1, "Duration too short"]
  },
  date: {
    type: Date,
    default: Date.now
  }
});
const Exercise = mongoose.model(
  "Exercise",
  exerciseSchema
); /* = <Your Model> */

// New user
app.post("/api/exercise/new-user", function(req, res, next) {
  const user = new User(req.body);
  user.save(function(err, data) {
    if (err) {
      if (err.code == 11000)
        return next({ status: 400, message: "Username taken" }); // Not unique
      return next(err);
    }
    res.json({ username: data.username, _id: data._id });
  });
});

// New activity
app.post("/api/exercise/add", function(req, res, next) {
  User.findById(req.body.userId, (err, user) => {
    if (!user) {
      return next({
        status: 400,
        message: "Unknown UserID"
      });
      if (err) return next(err);
    }
    if (req.body.date == "") req.body.date = Date.now();
    const exercise = new Exercise(req.body);
    exercise.save(function(err, savedExercise) {
      if (err) return next(err);
      res.json({
        _id: user._id,
        username: user.username,
        date: new Date(savedExercise.date).toDateString(),
        duration: savedExercise.duration,
        description: savedExercise.description
      });
    });
  });
});

// List activities
app.get("/api/exercise/log", function(req, res, next) {
  const from = new Date(req.query.from);
  const to = new Date(req.query.to);
  User.findById(req.query.userId, function(err, user) {
    if (!user) return next({ status: 400, message: "Unknown UserID" });
    if (err) return next(err);
    Exercise.find({
      userId: req.query.userId,
      date: {
        $lte: to != "Invalid Date" ? to : Date.now(),
        $gte: from != "Invalid Date" ? from : 0
      }
    })
      .sort({ date: "desc" })
      .limit(Number(req.query.limit))
      .exec(function(err, exercises) {
        if (err) return next(err);
        const response = {
          _id: user._id,
          username: user.username,
          log: exercises.map(exercise => ({
            description: exercise.description,
            duration: exercise.duration,
            date: exercise.date.toDateString()
          }))
        };
        res.json(response);
      });
  });
});

// List users
app.get("/api/exercise/users", function(req, res, next) {
  User.find({}, function(err, users) {
    if (err) return next(err);
    res.json(users);
  });
});

app.use(express.static("public"));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

// Not found middleware
app.use((req, res, next) => {
  return next({ status: 404, message: "Not Found" });
});

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage;

  if (err.errors) {
    // mongoose validation error
    errCode = 400; // bad request
    const keys = Object.keys(err.errors);
    // report the first validation error
    errMessage = err.errors[keys[0]].message;
  } else {
    // generic or custom error
    errCode = err.status || 500;
    errMessage = err.message || "Internal Server Error";
  }
  res
    .status(errCode)
    .type("txt")
    .send(errMessage);
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
