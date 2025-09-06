require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const pdfParse = require('pdf-parse');

const app = express();
app.use(cors());
app.use(express.json());

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer setup
const upload = multer({ dest: uploadDir });

// Health check endpoint
app.get('/', (req, res) => res.json({ ok: true, msg: 'ChainCV backend running' }));

// Upload endpoint (PDF analysis)
app.post('/upload', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const filePath = req.file.path;
    let text = "";

    // PDF parsing
    if (req.file.mimetype === "application/pdf") {
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);
      text = pdfData.text;
    } else {
      text = "Currently only PDF supported.";
    }

    // Simple AI-like analysis
    const score = text.includes("JavaScript") ? "Strong in JS" : "General";

    const response = {
      status: 'accepted',
      filename: req.file.originalname,
      savedPath: req.file.path,
      size: req.file.size,
      analysis: {
        wordCount: text.split(/\s+/).length,
        score,
      },
    };

    res.json(response);
  } catch (err) {
    console.error('Error processing upload:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Simple wallet verification stub
app.get('/verify/:wallet', (req, res) => {
  const wallet = req.params.wallet;
  res.json({ wallet, verified: false, message: "Verification not yet implemented" });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 ChainCV backend listening on http://localhost:${PORT}`));
