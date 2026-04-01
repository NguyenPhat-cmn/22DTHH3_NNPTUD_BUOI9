var express = require("express");
var router = express.Router();
let messageModel = require("../schemas/messages");
let { CheckLogin } = require("../utils/authHandler");
let multer = require("multer");

let storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, "public/uploads/"); },
  filename: function (req, file, cb) { cb(null, Date.now() + "-" + file.originalname); }
});
let upload = multer({ storage });

// GET / - lấy tin nhắn cuối cùng của mỗi cuộc trò chuyện
router.get("/", CheckLogin, async function (req, res) {
  try {
    let currentId = req.user._id;
    let messages = await messageModel.find({
      $or: [{ from: currentId }, { to: currentId }]
    }).populate("from", "username avatarUrl").populate("to", "username avatarUrl").sort({ createdAt: -1 });

    // Lấy tin nhắn cuối cùng của mỗi user khác
    let seen = {};
    let result = [];
    for (let msg of messages) {
      let otherId = msg.from._id.toString() === currentId.toString()
        ? msg.to._id.toString()
        : msg.from._id.toString();
      if (!seen[otherId]) {
        seen[otherId] = true;
        result.push(msg);
      }
    }
    res.send(result);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

// GET /:userID - lấy toàn bộ tin nhắn giữa user hiện tại và userID
router.get("/:userID", CheckLogin, async function (req, res) {
  try {
    let currentId = req.user._id;
    let otherID = req.params.userID;
    let messages = await messageModel.find({
      $or: [
        { from: currentId, to: otherID },
        { from: otherID, to: currentId }
      ]
    }).populate("from", "username avatarUrl").populate("to", "username avatarUrl").sort({ createdAt: 1 });
    res.send(messages);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

// POST / - gửi tin nhắn (text hoặc file)
router.post("/", CheckLogin, upload.single("file"), async function (req, res) {
  try {
    let { to, text } = req.body;
    let messageContent;
    if (req.file) {
      messageContent = { type: "file", text: req.file.path };
    } else {
      messageContent = { type: "text", text: text };
    }
    let newMsg = new messageModel({
      from: req.user._id,
      to: to,
      messageContent
    });
    await newMsg.save();
    let saved = await messageModel.findById(newMsg._id)
      .populate("from", "username avatarUrl")
      .populate("to", "username avatarUrl");
    res.send(saved);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

module.exports = router;
