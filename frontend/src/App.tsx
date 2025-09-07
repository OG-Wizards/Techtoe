import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { FiUpload, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import { RiLightbulbFlashLine } from 'react-icons/ri';
import jsPDF from 'jspdf';

interface AnalysisData {
  summary: string;
  strengths: string[];
  suggestion: string;
  overallScore: number;
}

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'analyzing' | 'completed' | 'error'>('idle');
  const [analysisResult, setAnalysisResult] = useState<AnalysisData | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState(0); // <-- Progress state
  const pollingInterval = useRef<number | null>(null);
  const API_BASE_URL = 'http://localhost:8080';

  useEffect(() => {
    return () => {
      if (pollingInterval.current) clearInterval(pollingInterval.current);
    };
  }, []);

  // Progress bar animation
  useEffect(() => {
    let interval: number;
    if (status === 'uploading' || status === 'analyzing') {
      setProgress(0);
      interval = window.setInterval(() => {
        setProgress((prev) => {
          if (prev >= 95) return prev; // stop at 95% until completed
          return prev + Math.random() * 5;
        });
      }, 300);
    } else if (status === 'completed' || status === 'error') {
      setProgress(100); // complete
    }
    return () => clearInterval(interval);
  }, [status]);

  const handleFileChange = (f: File) => {
    setFile(f);
    setStatus('idle');
    setAnalysisResult(null);
    setErrorMessage('');
    setProgress(0);
    if (pollingInterval.current) clearInterval(pollingInterval.current);
  };

  const handleUploadAndAnalyze = async () => {
    if (!file) {
      setErrorMessage('Please select a PDF file.');
      return;
    }

    setStatus('uploading');
    const formData = new FormData();
    formData.append('resume', file);

    try {
      const uploadRes = await axios.post<{ resumeId: string }>(`${API_BASE_URL}/upload`, formData);
      const resumeId = uploadRes.data.resumeId;

      await axios.post(`${API_BASE_URL}/analyze`, { resumeId });
      setStatus('analyzing');

      pollingInterval.current = window.setInterval(async () => {
        try {
          const statusRes = await axios.get<{ status: string; data?: AnalysisData; message?: string }>(
            `${API_BASE_URL}/analysis/status/${resumeId}`
          );

          if (statusRes.data.status === 'COMPLETED') {
            setAnalysisResult(statusRes.data.data || null);
            setStatus('completed');
            if (pollingInterval.current) clearInterval(pollingInterval.current);
          } else if (statusRes.data.status === 'FAILED') {
            setErrorMessage(statusRes.data.message || 'Analysis failed.');
            setStatus('error');
            if (pollingInterval.current) clearInterval(pollingInterval.current);
          }
        } catch {
          setErrorMessage('Could not fetch analysis status.');
          setStatus('error');
          if (pollingInterval.current) clearInterval(pollingInterval.current);
        }
      }, 3000);
    } catch {
      setErrorMessage('File upload failed.');
      setStatus('error');
    }
  };

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const downloadPDF = () => {
    if (!analysisResult) return;

    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('AI Resume Analysis', 14, 20);
    doc.setFontSize(12);
    doc.text(`Summary: ${analysisResult.summary}`, 14, 35);

    doc.text('Strengths:', 14, 50);
    analysisResult.strengths.forEach((s, i) => {
      doc.text(`- ${s}`, 18, 58 + i * 8);
    });

    const suggestionStartY = 58 + analysisResult.strengths.length * 8 + 10;
    doc.text('Suggestion:', 14, suggestionStartY);
    doc.text(analysisResult.suggestion, 18, suggestionStartY + 8);

    const scoreY = suggestionStartY + 28;
    doc.text(`Overall Score: ${analysisResult.overallScore} / 100`, 14, scoreY);

    doc.save('resume_analysis.pdf');
  };

  return (
    <div className="min-h-screen bg-gradient-to-r from-purple-50 to-blue-50 flex flex-col items-center justify-start py-12 px-4">
      <h1 className="text-4xl font-bold text-gray-800 mb-6">AI Resume Analyzer</h1>

      {/* File Upload Box */}
      <div
        className={`w-full max-w-lg p-6 bg-white rounded-xl shadow-md flex flex-col gap-4 border-2 border-dashed ${
          dragActive ? 'border-purple-400' : 'border-gray-300'
        }`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
      >
        <label className="flex flex-col items-center justify-center gap-2 cursor-pointer">
          <FiUpload className="text-purple-500 text-3xl" />
          <span className="text-gray-500">{file ? file.name : 'Drag & drop a PDF or click to upload'}</span>
          <input
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => e.target.files && handleFileChange(e.target.files[0])}
          />
        </label>
        <button
          onClick={handleUploadAndAnalyze}
          disabled={!file || status === 'uploading' || status === 'analyzing'}
          className="bg-purple-500 text-white font-semibold py-2 rounded hover:bg-purple-600 disabled:opacity-50 transition-colors"
        >
          {status === 'uploading' || status === 'analyzing' ? 'Processing...' : 'Upload & Analyze'}
        </button>
        {status === 'error' && <p className="text-red-500 font-medium">{errorMessage}</p>}

        {/* Progress Bar */}
        {(status === 'uploading' || status === 'analyzing') && (
          <div className="w-full mt-2">
            <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-3 bg-purple-500 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-purple-500 mt-1 text-sm font-medium">
              {status === 'uploading' ? 'Uploading file...' : 'Analyzing resume...'}
            </p>
          </div>
        )}
      </div>

      {/* Analysis Result */}
      {status === 'completed' && analysisResult && (
        <div className="mt-8 bg-white p-6 rounded-xl shadow-md w-full max-w-lg flex flex-col gap-4">
          <h2 className="text-2xl font-bold text-gray-700 flex items-center gap-2">
            <FiCheckCircle className="text-green-500" /> Analysis Result
          </h2>
          <p className="text-gray-700"><strong>Summary:</strong> {analysisResult.summary}</p>

          <div>
            <h3 className="font-semibold text-gray-600 flex items-center gap-1"><RiLightbulbFlashLine className="text-yellow-500" /> Strengths:</h3>
            <ul className="list-disc list-inside text-gray-700">
              {analysisResult.strengths.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-gray-600 flex items-center gap-1"><FiAlertCircle className="text-red-500" /> Suggestion:</h3>
            <p className="text-gray-700">{analysisResult.suggestion}</p>
          </div>

          <p className="text-gray-800 font-semibold"><strong>Overall Score:</strong> {analysisResult.overallScore} / 100</p>

          <button
            onClick={downloadPDF}
            className="mt-2 bg-green-500 text-white py-2 rounded hover:bg-green-600 transition-colors"
          >
            Download PDF
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
