const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ResumeSchema = new Schema({
  originalName: { type: String, required: true },
  filePath: { type: String, required: true },
  status: { type: String, default: 'UPLOADED' }, // UPLOADED, PROCESSING, COMPLETED, FAILED
  uploadDate: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Resume', ResumeSchema);