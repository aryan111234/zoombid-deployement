const router = require("express").Router();
const Bid = require("../models/bidModel");
const authMiddleware = require("../middlewares/authMiddleware");
const Notification = require("../models/notificationsModel");
const Product = require("../models/productModel");

//place a new Bid
router.post("/place-new-bid", authMiddleware, async (req, res) => {
  try {
    const newBid = new Bid(req.body);
    await newBid.save();
    res.send({ success: true, message: "Bid placed successfully." });
  } catch (error) {
    res.send({ success: false, message: error.message });
  }
});

//get all bids
router.post("/get-all-bids", authMiddleware, async (req, res) => {
  try {
    const { product, seller, buyer } = req.body;
    let filters = {};
    if (product) {
      filters.product = product;
    }
    if (seller) {
      filters.seller = seller;
    }

    if (buyer) {
      filters.buyer = buyer;
    }
    const bids = await Bid.find(filters)
      .populate("product")
      .populate("buyer")
      .populate("seller")
      .sort({ createdAt: -1 });
    res.send({ success: true, data: bids });
  } catch (error) {
    res.send({ success: false, message: error.message });
  }
});

//update Bid status
router.put("/update-bids-status/:id", authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const updatedProduct = await Bid.findByIdAndUpdate(req.params.id, {
      status,
    });
    const product = await Product.findById(updatedProduct.product);
    // Determine the message 
    let customMessage;
    if (status === "accepted") {
      customMessage = `Congratulations! Your bid for ${product.name} has been ${status}`;
    } else {
      customMessage = `Your bid for ${product.name} has been ${status}`;
    }
    //send notification to the buyer
    const newNotification = new Notification({
      user: updatedProduct.buyer,
      title: `Bid ${status}`,
      message: `${customMessage}`,
      onClick: `/sellerdashboard`,
      read: false,
    });
    await newNotification.save();

    res.send({
      success: true,
      message: " Bid status updated successfully",
    });
  } catch (error) {
    res.send({
      success: false,
      message: error.message,
    });
  }
});

//delete a bid
router.delete("/delete-bid/:id", authMiddleware, async (req, res) => {
  try {
    await Bid.findByIdAndDelete(req.params.id);
    res.send({
      success: true,
      message: "Bid deleted successfully",
    });
  } catch (error) {
    res.send({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;