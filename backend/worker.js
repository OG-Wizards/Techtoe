const { TaskManager } = require('@io-orkes/conductor-javascript');
const pdf = require('pdf-parse');
const fs = require('fs');
const { analyzeResumeWithAI } = require('./services/aiAnalyzer');
const Analysis = require('./models/Analysis');
const Resume = require('./models/Resume');

// --- Fetch file path task ---
async function fetch_file_path_from_mongo(task) {
  const { resumeId, _createdBy } = task.inputData;
  try {
    let resume = resumeId ? await Resume.findById(resumeId) : await Resume.findOne({ _createdBy });
    if (!resume || !resume.filePath) throw new Error('Resume not found or filePath missing');

    return { status: 'COMPLETED', outputData: { filePath: resume.filePath, resumeId: resume._id.toString() } };
  } catch (err) {
    return { status: 'COMPLETED', outputData: { filePath: null, resumeId, error: err.message } };
  }
}

// --- Process resume task ---
async function process_resume(task) {
  const { filePath, resumeId } = task.inputData;

  try {
    if (!filePath || !fs.existsSync(filePath)) throw new Error(`File not found at path: ${filePath}`);

    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    const text = data.text?.trim();
    if (!text) throw new Error('PDF text extraction returned empty content');

    console.log('Text extraction successful.');
    const analysisJson = await analyzeResumeWithAI(text);
    console.log('AI analysis successful.');

    await Analysis.create({ resumeId, analysisData: analysisJson, createdAt: new Date() });
    await Resume.findByIdAndUpdate(resumeId, { status: 'COMPLETED', completedAt: new Date() });

    return { status: 'COMPLETED', outputData: { status: 'Success', message: 'Resume processed', resumeId } };
  } catch (err) {
    console.error('Resume processing failed:', err);
    await Resume.findByIdAndUpdate(resumeId, { status: 'FAILED', error: err.message, failedAt: new Date() }).catch(() => {});
    return { status: 'COMPLETED', outputData: { status: 'Failure', message: err.message, resumeId } };
  }
}

// --- Worker initialization ---
function startWorkers(client) {
  console.log('=== STARTING ORKES WORKERS ===');
  const taskManager = new TaskManager(client, [
    { taskDefName: 'fetch_file_path_from_mongo', execute: fetch_file_path_from_mongo },
    { taskDefName: 'process_resume', execute: process_resume },
  ], { logger: console, options: { concurrency: 5, pollInterval: 100 } });

  taskManager.startPolling();
  console.log('=== WORKERS READY AND POLLING ===');
}

module.exports = startWorkers;
