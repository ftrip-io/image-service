import express from "express";
import {
  existsSync,
  mkdirSync,
  rmSync,
  readdirSync,
  renameSync,
  unlinkSync,
} from "fs";
import { join } from "path";
import multer, { diskStorage } from "multer";
import { request } from "http";
import filenamify from "filenamify";

const app = express();
const imagesDir = "images";

const multerStorage = diskStorage({
  destination: (req, _, cb) => {
    const folderPath = join(imagesDir, req.params.groupName);
    if (!existsSync(folderPath)) mkdirSync(folderPath, { recursive: true });
    cb(null, folderPath);
  },
  filename: (_, file, cb) => cb(null, filenamify(file.originalname)),
});
const upload = multer({ storage: multerStorage });

app.use(express.json()).use("/images", express.static(imagesDir));

app.post(
  "/api/images/:groupName",
  authorize,
  upload.array("images", 50),
  async (_, res) => {
    res.send("Images uploaded successfully!");
  }
);

app.delete("/api/images/:groupName", authorize, async (req, res) => {
  const groupName = req.params.groupName;
  const folderPath = join(imagesDir, groupName);
  if (!existsSync(folderPath)) {
    return res.status(404).send("Group not found");
  }
  rmSync(folderPath, { recursive: true });
  res.send("Group and images deleted successfully!");
});

app.get("/api/images/:groupName", async (req, res) => {
  const groupName = req.params.groupName;
  const folderPath = join(imagesDir, groupName);
  if (!existsSync(folderPath)) {
    return res.status(404).send("Group not found");
  }
  const imageUrls = readdirSync(folderPath).map(
    (file) => `${req.protocol}://${req.get("host")}/images/${groupName}/${file}`
  );
  res.json(imageUrls);
});

app.get("/", async (_, res) => {
  res.send("Image server");
});

app.put("/api/images/:groupName", authorize, async (req, res) => {
  const groupName = req.params.groupName;
  const folderPath = join(imagesDir, groupName);
  if (!existsSync(folderPath)) {
    return res.status(404).send("Group not found");
  }
  const data = req.body;
  if (
    !data ||
    typeof data[Symbol.iterator] !== "function" ||
    !data.every((i) => typeof i?.old === "string")
  ) {
    return res.status(400).send("Expected { old: string, new?: string }[]");
  }
  if (data.some((i) => i.old.includes("/") || i.old.includes("\\"))) {
    return res.status(400).send("Path should not contain '/' or '\\'");
  }
  for (const item of data) {
    const filePath = join(folderPath, item.old);
    if (!existsSync(filePath)) continue;
    if (item.new) {
      renameSync(filePath, join(folderPath, filenamify(item.new + "")));
    } else {
      unlinkSync(filePath);
    }
  }
  const imageUrls = readdirSync(folderPath).map(
    (file) => `${req.protocol}://${req.get("host")}/images/${groupName}/${file}`
  );
  res.json(imageUrls);
});

app.listen(process.env.PORT, () => {
  console.log(
    `⚡️[server]: Server running at http://localhost:${process.env.PORT}`
  );
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
    request(options).on("response", resolve).on("error", reject).end()
  );
}
