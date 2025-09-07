const mongoose = require('mongoose');

const AnalysisSchema = new mongoose.Schema({
  resumeId: { type: String, required: true },
  analysisData: {
    summary: { type: String, required: true },
    strengths: { type: [String], required: true },
    suggestion: { type: String, required: true }, // updated from areasForImprovement
    overallScore: { type: Number, required: true },
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Analysis', AnalysisSchema);
