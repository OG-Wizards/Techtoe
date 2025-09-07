const mongoose = require('mongoose');

const ResumeSchema = new mongoose.Schema({
  originalName: { type: String, required: true },
  filePath: { type: String, required: true },
  _createdBy: { type: String, required: true },
  status: { type: String, default: 'PENDING' },
  completedAt: { type: Date },
  failedAt: { type: Date },
  error: { type: String },
});

module.exports = mongoose.model('Resume', ResumeSchema);
