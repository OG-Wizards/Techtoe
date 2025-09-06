require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { orkesConductorClient } = require('@io-orkes/conductor-javascript');

// --- Internal Imports ---
const connectDB = require('./config/db');
const Resume = require('./models/Resume');
const Analysis = require('./models/Analysis');
const startWorkers = require('./worker.js');

// --- Initializations ---
const app = express();
const port = process.env.PORT || 8080;
app.use(cors());
app.use(express.json());

// --- Database Connection ---
connectDB();

// --- Static Folder for Uploads ---
const uploadDir = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadDir));
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// --- Multer File Upload Setup ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`);
  },
});
const upload = multer({ storage });

// --- Main async function ---
const initializeServer = async () => {
  try {
    const serverUrl = process.env.ORKES_SERVER_URL;
    console.log("Using Orkes server URL:", serverUrl);

    // --- Orkes Conductor Client Setup ---
    const orkesClient = await orkesConductorClient({
      keyId: process.env.ORKES_KEY_ID,
      keySecret: process.env.ORKES_KEY_SECRET,
      serverUrl: serverUrl,
    });
    console.log("✅ Orkes Conductor Client connected");

    // --- API Routes ---
    app.get('/', (req, res) => res.json({ ok: true, msg: 'ChainCV backend running' }));

    app.post('/upload', upload.single('resume'), async (req, res) => {
      try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        const newResume = new Resume({
          originalName: req.file.originalname,
          filePath: req.file.path,
          _createdBy: req.body._createdBy || 'roshanmondal44@gmail.com', // Allow _createdBy from request
        });
        const savedResume = await newResume.save();
        res.status(201).json({
          message: 'File uploaded and ready for analysis.',
          resumeId: savedResume._id,
          fileName: savedResume.originalName,
        });
      } catch (err) {
        console.error('Error during file upload:', err);
        res.status(500).json({ error: 'Server error during upload' });
      }
    });

    app.post('/analyze', async (req, res) => {
      try {
        const { resumeId } = req.body;
        if (!resumeId) return res.status(400).json({ error: 'resumeId is required' });

        const resume = await Resume.findById(resumeId);
        if (!resume) return res.status(404).json({ error: 'Resume not found' });

        const workflowInstance = await orkesClient.workflowResource.startWorkflow({
          name: "resume_analysis_workflow_v2",
          version: 1,
          input: {
            resumeId: resume._id.toString(),
            _createdBy: resume._createdBy || "roshanmondal44@gmail.com"
          },
        });

        await Resume.findByIdAndUpdate(resumeId, { status: 'PROCESSING' });

        res.status(202).json({
          message: "Analysis workflow started successfully.",
          workflowId: workflowInstance.workflowId,
        });
      } catch (err) {
        console.error('Error starting analysis workflow:', err);
        res.status(500).json({ error: 'Could not start analysis workflow' });
      }
    });

    app.get('/analysis/status/:resumeId', async (req, res) => {
      try {
        const { resumeId } = req.params;
        const result = await Analysis.findOne({ resumeId });
        if (result) return res.json({ status: 'COMPLETED', data: result.analysisData });

        const resume = await Resume.findById(resumeId);
        if (resume && resume.status === 'FAILED') {
          return res.json({ status: 'FAILED', message: 'Analysis failed during processing.' });
        }
        res.json({ status: 'PENDING' });
      } catch (err) {
        console.error('Error fetching analysis status:', err);
        res.status(500).json({ error: 'Server error while checking status' });
      }
    });

    // --- Start server ---
    app.listen(port, () => {
      console.log(`🚀 ChainCV backend listening on http://localhost:${port}`);
      startWorkers(orkesClient);
    });
  } catch (error) {
    console.error("❌ Failed to initialize server:", error);
    process.exit(1);
  }
};

// --- Run server ---
initializeServer();