const { TaskManager } = require('@io-orkes/conductor-javascript');
const pdf = require('pdf-parse');
const fs = require('fs');
const { analyzeResumeWithAI } = require('./services/aiAnalyzer');
const Analysis = require('./models/Analysis');
const Resume = require('./models/Resume');

// --- Task Implementations ---

async function fetch_file_path_from_mongo(task) {
  console.log('=== FETCH FILE PATH FROM MONGO TASK STARTED ===');
  console.log('DEBUG - Fetch task input:', JSON.stringify(task.inputData, null, 2));

  const { resumeId, _createdBy } = task.inputData;

  try {
    if (!resumeId && !_createdBy) {
      throw new Error("resumeId or _createdBy is required to fetch file path");
    }

    let resume;
    if (resumeId) {
      resume = await Resume.findById(resumeId);
    } else if (_createdBy) {
      resume = await Resume.findOne({ _createdBy });
    }

    if (!resume || !resume.filePath) {
      throw new Error(`No resume found or filePath missing for resumeId: ${resumeId} or _createdBy: ${_createdBy}`);
    }

    return {
      status: 'COMPLETED',
      outputData: {
        filePath: resume.filePath,
        resumeId: resume._id.toString(),
        fetchStatus: "Success"
      }
    };
  } catch (error) {
    console.error('Error fetching file path from MongoDB:', error);
    return {
      status: 'COMPLETED',
      outputData: {
        filePath: null,
        resumeId,
        fetchStatus: "Failure",
        error: error.message
      }
    };
  }
}

async function process_resume(task) {
  console.log('=== PROCESS RESUME TASK STARTED ===');
  console.log('DEBUG - Process task input:', JSON.stringify(task.inputData, null, 2));

  const filePath = task.inputData.filePath;
  const resumeId = task.inputData.resumeId;

  try {
    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error(`File not found at path: ${filePath}`);
    }

    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);

    const text = data.text?.trim();
    if (!text) {
      throw new Error("PDF text extraction returned empty content");
    }

    console.log("Text extraction successful.");
    const analysisJson = await analyzeResumeWithAI(text);
    console.log('AI analysis successful.');

    await Analysis.create({
      resumeId,
      analysisData: analysisJson,
      createdAt: new Date()
    });

    await Resume.findByIdAndUpdate(resumeId, {
      status: 'COMPLETED',
      completedAt: new Date()
    });

    return {
      status: 'COMPLETED',
      outputData: {
        status: "Success",
        message: "Resume processed and saved successfully",
        resumeId
      }
    };
  } catch (error) {
    console.error("Resume processing failed:", error);

    await Resume.findByIdAndUpdate(resumeId, {
      status: 'FAILED',
      error: error.message,
      failedAt: new Date()
    }).catch(() => {});

    return {
      status: 'COMPLETED',
      outputData: {
        status: "Failure",
        message: `Resume processing failed: ${error.message}`,
        resumeId
      }
    };
  }
}

// --- Main Worker Setup Function ---
function startWorkers(client) {
  console.log('=== STARTING ORKES WORKERS ===');
  const taskManager = new TaskManager(client, [
    { taskDefName: 'fetch_file_path_from_mongo', execute: fetch_file_path_from_mongo },
    { taskDefName: 'process_resume', execute: process_resume },
  ], {
    logger: console,
    options: { concurrency: 5, pollInterval: 100 }
  });

  taskManager.startPolling();
  console.log('=== WORKERS READY AND POLLING ===');
}

module.exports = startWorkers;