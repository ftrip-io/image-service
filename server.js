const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const http = require("http");

const app = express();
const imagesDir = "images";

const multerStorage = multer.diskStorage({
  destination: (req, _, cb) => {
    const folderPath = path.join(imagesDir, req.params.groupName);
    if (!fs.existsSync(folderPath))
      fs.mkdirSync(folderPath, { recursive: true });
    cb(null, folderPath);
  },
  filename: (_, file, cb) => cb(null, file.originalname),
});
const upload = multer({ storage: multerStorage });

app.post(
  "/api/images/:groupName",
  authorize,
  upload.array("images", 10),
  async (_, res) => {
    res.send("Images uploaded successfully!");
  }
);

app.delete("/api/images/:groupName", authorize, async (req, res) => {
  const groupName = req.params.groupName;
  const folderPath = path.join(imagesDir, groupName);
  if (!fs.existsSync(folderPath)) {
    return res.status(404).send("Group not found");
  }
  fs.rmSync(folderPath, { recursive: true });
  res.send("Group and images deleted successfully!");
});

app.get("/api/images/:groupName", async (req, res) => {
  const groupName = req.params.groupName;
  const folderPath = path.join(imagesDir, groupName);
  if (!fs.existsSync(folderPath)) {
    return res.status(404).send("Group not found");
  }
  const imageUrls = fs
    .readdirSync(folderPath)
    .map(
      (file) =>
        `${req.protocol}://${req.get("host")}/images/${groupName}/${file}`
    );
  res.json(imageUrls);
});

app.get("/", async (_, res) => {
  res.send("Image server");
});

app.use("/images", express.static(imagesDir));

app.listen(3001, () => {
  console.log("Server running on http://localhost:3001");
});

async function authorize(req, res, next) {
  const authorization = req.headers["authorization"] || "";
  const token = authorization && authorization.split(" ")[1];
  if (!token) return res.status(401).send("No JWT!");
  try {
    const response = await doRequest({
      hostname: process.env.AUTH_HOSTNAME,
      port: process.env.AUTH_PORT,
      path: `${process.env.AUTH_PATH}${req.params.groupName}`,
      method: "GET",
      headers: { Authorization: authorization },
    });
    if (response.statusCode === 200) next();
    else return res.status(response.statusCode).send("Can not modify!");
  } catch (err) {
    console.error(err);
    return res.status(401).send("Some error");
  }
}

function doRequest(options) {
  return new Promise((resolve, reject) =>
    http.request(options).on("response", resolve).on("error", reject).end()
  );
}
