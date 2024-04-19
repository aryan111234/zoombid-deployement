const router = require("express").Router();
const { JsonWebTokenError } = require("jsonwebtoken");
const User = require("../models/userModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const authMiddleware = require("../middlewares/authMiddleware");
const nodemailer = require("nodemailer");

//new user registration
router.post("/register", async (req, res) => {
  try {
    //check if user already exists
    const user = await User.findOne({ email: req.body.email });
    if (user) {
      throw new Error("User already exists");
    }

    //hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(req.body.password, salt);
    req.body.password = hashedPassword;

    //save user
    const newUser = new User(req.body);
    await newUser.save();
    res.send({
      success: true,
      message: "User created successfully",
    });
  } catch (error) {
    res.send({
      sucess: false,
      message: error.message,
    });
  }
});

// user login
router.post("/login", async (req, res) => {
  try {
    //check if user exists
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      throw new Error("User does not exist");
    }
    // if user is active
    if (user.status !== "active") {
      throw new Error("The user account is blocked, please contact admin");
    }

    //check password
    const validPassword = await bcrypt.compare(
      req.body.password,
      user.password
    );
    if (!validPassword) {
      throw new Error("Invalid password");
    }
    // create and assign token
    const token = jwt.sign({ userId: user._id }, process.env.jwt_secret, {
      expiresIn: "2d",
    });
    res.cookie("token", token, {
      expires: new Date(Date.now() + 86400000),
    });
    //send response
    res.send({
      success: true,
      message: "User logged in successfully",
      data: token,
    });
  } catch (error) {
    res.send({
      success: false,
      message: error.message,
    });
  }
});

//get current user
router.get("/get-current-user", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.body.userId);
    res.send({
      success: true,
      message: "User fetched successfully",
      data: user,
    });
  } catch (error) {
    res.send({
      success: false,
      message: error.message,
    });
  }
});

//get all users
router.get("/get-users", authMiddleware, async (req, res) => {
  try {
    const users = await User.find();
    res.send({
      success: true,
      message: "User fetched successfully",
      data: users,
    });
  } catch (error) {
    res.send({
      success: false,
      message: error.message,
    });
  }
});

//update user status
router.put("/update-user-status/:id", authMiddleware, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, req.body);
    res.send({
      success: true,
      message: "User status updated successfully",
    });
  } catch (error) {
    res.send({
      success: false,
      message: error.message,
    });
  }
});

//forgot password requests with OTP
router.post("/forgot-password", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      throw new Error("User does not exist");
    }

    // Function to generate a random OTP of specified length
    function generateOTP(length) {
      const digits = "0123456789";
      let otp = "";
      for (let i = 0; i < length; i++) {
        otp += digits[Math.floor(Math.random() * 10)];
      }
      return otp;
    }

    // Generate a unique OTP for password reset only if the user doesn't have one
    if (!user.otpSecret) {
      const otp = generateOTP(6);

      // Save the OTP secret to the user in the database
      user.otpSecret = otp;
      await user.save();
    }

    // Get the current OTP from the user's document
    const otp = user.otpSecret;

    // Send an email with the OTP for password reset
    const transporter = nodemailer.createTransport({
      // Configure your nodemailer transporter
      service: "gmail",
      auth: {
        user: "ZoomBidmarketplace@gmail.com",
        pass: "ltwf yrad pvnd ubog",
      },
    });

    const mailOptions = {
      from: "ZoomBidmarketplace@gmail.com",
      to: user.email,
      subject: "Password Reset OTP",
      html: `
      <p>Hi ${user.name},</p>
      <p>We received a request to reset your password. To reset your password, use this OTP: <strong>${otp}</strong></p>
      <p>Thank you!<br>ZoomBid Support Team</p>
    `,
    };

    await transporter.sendMail(mailOptions);

    // Send a success response
    res.send({
      success: true,
      message: "OTP sent to your email for password reset",
    });
  } catch (error) {
    // Send an error response
    res.send({
      success: false,
      message: error.message,
    });
  }
});

// OTP verification and password update
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      throw new Error("User does not exist");
    }

    // Verify the OTP
    if (user.otpSecret !== otp) {
      throw new Error("Invalid OTP");
    }

    // Update the user's password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;

    // Clear the OTP-related fields
    user.otpSecret = null;

    // Save the updated user
    await user.save();

    // Send a success response
    res.send({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    // Send an error response
    res.send({
      success: false,
      message: error.message,
    });
  }
});

// Update user information
router.put("/update-user/:id", authMiddleware, async (req, res) => {
  try {
    const { name, email } = req.body;

    // Validate if name and email are present in the request body
    if (!name || !email) {
      return res.send({
        success: false,
        message: "Name, email, and password are required fields",
      });
    }

    // Update user information in the database with the hashed password
    await User.findByIdAndUpdate(req.params.id, {
      name,
      email,
    });

    res.send({
      success: true,
      message: "User information updated successfully",
    });
  } catch (error) {
    res.send({
      success: false,
      message: error.message,
    });
  }
});

//change password
router.put("/change-password/:id", authMiddleware, async (req, res) => {
  try {
    const { password } = req.body;

    // Validate password is present in the request body
    if (!password) {
      return res.send({
        success: false,
        message: "password is required",
      });
    }

    // Hash the password before storing it in the database
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user information in the database with the hashed password
    await User.findByIdAndUpdate(req.params.id, {
      password: hashedPassword,
    });

    res.send({
      success: true,
      message: "User information updated successfully",
    });
  } catch (error) {
    res.send({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;