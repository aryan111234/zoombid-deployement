const router = require("express").Router();
const Product = require("../models/productModel");
const User = require("../models/userModel");
const authMiddleware = require("../middlewares/authMiddleware");
const cloudinary = require("../config/cloudinaryConfig");
const multer = require("multer");
const Notification = require("../models/notificationsModel");

//add a new product
router.post("/add-product", authMiddleware, async (req, res) => {
  try {
    const newProduct = new Product(req.body);
    await newProduct.save();
    const user = await User.findById(req.body.userId);
    //send notifications to the admin
    const admins = await User.find({ role: "admin" });
    admins.forEach(async (admin) => {
      const newNotification = new Notification({
        user: admin._id,
        title: "New Product Added!",
        message: `${user.name} added a new product.Take a time to review it`,
        onClick: `/admin`,
        read: false,
      });
      await newNotification.save();
    });

    res.send({
      success: true,
      message: "Product added successfully",
    });
  } catch (error) {
    res.send({
      success: false,
      message: error.message,
    });
  }
});

//get all products
router.post("/get-products", async (req, res) => {
  try {
    const {
      seller,
      category = [],
      condition = [],
      minPrice,
      maxPrice,
      status,
      search,
    } = req.body;
    let filters = {};

    if (seller) {
      filters.seller = seller;
    }
    if (status) {
      filters.status = status;
    }
    // filter by category
    if (category.length > 0) {
      filters.category = { $in: category };
    }
    // filter by condition
    if (condition.length > 0) {
      filters.condition = { $in: condition };
    }
    //filter by price
    if (minPrice !== undefined || maxPrice !== undefined) {
      filters.price = {};
      if (minPrice !== undefined) {
        filters.price.$gte = minPrice;
      }
      if (maxPrice !== undefined) {
        filters.price.$lte = maxPrice;
      }
    }
    // search by name
    if (search) {
      filters.$or = [{ name: { $regex: search, $options: "i" } }];
    }

    const products = await Product.find(filters)
      .populate("seller")
      .sort({ createdAt: -1 });

    res.send({
      success: true,
      data: products,
    });
  } catch (error) {
    res.send({
      success: false,
      message: error.message,
    });
  }
});

//get product by id
router.get("/get-product-by-id/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate("seller");
    res.send({
      success: true,
      data: product,
    });
  } catch (error) {
    res.send({
      success: false,
      message: error.message,
    });
  }
});

//edit product
router.put("/edit-product/:id", authMiddleware, async (req, res) => {
  try {
    await Product.findByIdAndUpdate(req.params.id, req.body);
    res.send({
      success: true,
      message: "Product updated successfully",
    });
  } catch (error) {
    res.send({
      success: false,
      message: error.message,
    });
  }
});

//delete product
router.delete("/delete-product/:id", authMiddleware, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.send({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    res.send({
      success: false,
      message: error.message,
    });
  }
});
//get image from user
const storage = multer.diskStorage({
  filename: function (req, file, callback) {
    callback(null, Date.now() + file.originalname);
  },
});
router.post(
  "/upload-image-to-product",
  authMiddleware,
  multer({ storage: storage }).single("file"),
  async (req, res) => {
    try {
      //upload image to cloudinary
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "ZoomBid",
      });

      const productId = req.body.productId;
      await Product.findByIdAndUpdate(productId, {
        $push: { images: result.secure_url },
      });
      res.send({
        success: true,
        message: "Image uploaded Successfully",
        data: result.secure_url,
      });
    } catch (error) {
      res.send({
        success: false,
        message: error.message,
      });
    }
  }
);

//update product status
router.put("/update-product-status/:id", authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, {
      status,
    });

    //send notification to the seller
    const newNotification = new Notification({
      user: updatedProduct.seller,
      title: `Product ${status}`,
      message: `Your product ${updatedProduct.name} has been ${status}`,
      onClick: `/sellerdashboard`,
      read: false,
    });
    await newNotification.save();

    res.send({
      success: true,
      message: " Product status updated successfully",
    });
  } catch (error) {
    res.send({
      success: false,
      message: error.message,
    });
  }
});

// Update page view count for a specific product
router.post("/update-view-count/:id", authMiddleware, async (req, res) => {
  try {
    const productId = req.params.id;

    // Retrieve the current product information from the database
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Increment the view count
    const updatedViewCount = (product.viewCount || 0) + 1;

    // Update the view count in the database
    const result = await Product.findByIdAndUpdate(
      productId,
      { viewCount: updatedViewCount },
      { new: true }
    );

    if (!result) {
      throw new Error("Failed to update view count");
    }

    // Send the updated view count as a response
    res.json({ viewCount: updatedViewCount });
  } catch (error) {
    console.error("Error updating view count:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;