import express from "express";
import multer from "multer";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import pkg from "pg";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();
const { Client } = pkg;

const app = express();

// === Multer setup (keep file extensions) ===
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${file.originalname.replace(/\s/g, "_")}`;
    cb(null, name);
  },
});
const upload = multer({ storage });

// === Port and AWS setup ===
const PORT = 3100;
const REGION = process.env.AWS_REGION;
const BUCKET = process.env.S3_BUCKET;

// === AWS S3 Client ===
const s3 = new S3Client({ region: REGION });

// === PostgreSQL Client ===
const db = new Client({
  host: process.env.RDS_HOST,
  port: process.env.RDS_PORT,
  user: process.env.RDS_USER,
  password: process.env.RDS_PASS,
  database: process.env.RDS_DB,
  ssl: { rejectUnauthorized: false },
});

// === Connect to DB ===
db.connect()
  .then(() => console.log("✅ Connected to PostgreSQL"))
  .catch((err) => {
    console.error("❌ Database connection failed:", err.message);
    process.exit(1);
  });

// === Serve static files ===
app.use(express.static("public"));

// === API: Upload image & run prediction ===
app.post("/predict", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const imagePath = req.file.path;
  const imageName = req.file.originalname.replace(/\s/g, "_");

  console.log("🖼️ Received file:", imagePath);

  try {
    // === Run Python predictor ===
    const py = spawn("python3", ["predict.py", imagePath]);
    let output = "";
    let errOutput = "";

    py.stdout.on("data", (data) => (output += data.toString()));
    py.stderr.on("data", (data) => (errOutput += data.toString()));

    py.on("close", async (code) => {
      if (errOutput) console.error("🐍 Python stderr:", errOutput);

      let result;
      try {
        result = JSON.parse(output);
      } catch {
        console.error("⚠️ Prediction parse error, raw output:", output);
        result = { label: "unknown", confidence: 0 };
      }

      try {
        // === Upload image to S3 ===
        const s3Key = `uploads/${Date.now()}_${imageName}`;
        const uploadCmd = new PutObjectCommand({
          Bucket: BUCKET,
          Key: s3Key,
          Body: fs.createReadStream(imagePath),
         
        });

        await s3.send(uploadCmd);
        const s3Url = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${s3Key}`;

        console.log("☁️ Uploaded to S3:", s3Url);

        // === Save result to PostgreSQL ===
        await db.query(
          "INSERT INTO predictions (image_name, s3_url, result, confidence) VALUES ($1,$2,$3,$4)",
          [imageName, s3Url, result.label || "unknown", result.confidence || 0]
        );

        // === Cleanup local file ===
        fs.unlinkSync(imagePath);

        // === Respond to client ===
        res.json({ s3Url, result });
      } catch (err) {
        console.error("❌ Upload/DB error:", err);
        res.status(500).json({ error: "Upload or database error" });
      }
    });
  } catch (err) {
    console.error("❌ Prediction failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// === Start server ===
app.listen(PORT, "0.0.0.0", () =>
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`)
);
