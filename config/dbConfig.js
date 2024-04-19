const mongoose = require("mongoose");

// Use your MongoDB URI from the environment variable
mongoose.connect(process.env.mongo_url);

// mongoose.connect(mongoURI, {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// });

const connection = mongoose.connection;

connection.on("connected", () => {
  console.log("mongo DB connection Successful");
});

connection.on("error", (err) => {
  console.log("mongo DB connection Failed");
});

module.exports = connection;
