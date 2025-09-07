import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

// --- Type definition for AI analysis result ---
interface AnalysisData {
  summary: string;
  strengths: string[];
  suggestion: string; // changed from areasForImprovement
  overallScore: number;
}

// --- Component to display analysis ---
const AnalysisDisplay: React.FC<{ result: AnalysisData }> = ({ result }) => (
  <div className="analysis-result">
    <h3>Analysis Complete!</h3>
    <p><strong>Summary:</strong> {result.summary}</p>
    <div>
      <h4>Strengths: ✅</h4>
      <ul>{result.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
    </div>
    <div>
      <h4>Suggestion: 💡</h4>
      <p>{result.suggestion}</p>
    </div>
    <p><strong>Overall Score:</strong> {result.overallScore} / 100</p>
  </div>
);

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'analyzing' | 'completed' | 'error'>('idle');
  const [analysisResult, setAnalysisResult] = useState<AnalysisData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const pollingIntervalId = React.useRef<number | null>(null);

  const API_BASE_URL = 'http://localhost:8080'; // backend URL

  useEffect(() => {
    return () => {
      if (pollingIntervalId.current) clearInterval(pollingIntervalId.current);
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
      setStatus('idle');
      setAnalysisResult(null);
      setErrorMessage('');
      if (pollingIntervalId.current) clearInterval(pollingIntervalId.current);
    }
  };

  const handleUploadAndAnalyze = async () => {
    if (!file) {
      setErrorMessage('Please choose a file first.');
      return;
    }

    setStatus('uploading');
    setErrorMessage('');
    const formData = new FormData();
    formData.append('resume', file);

    try {
      // Upload resume
      const uploadRes = await axios.post<{ resumeId: string }>(`${API_BASE_URL}/upload`, formData);
      const { resumeId } = uploadRes.data;

      // Trigger analysis workflow
      await axios.post(`${API_BASE_URL}/analyze`, { resumeId });
      setStatus('analyzing');

      // Polling for results
      pollingIntervalId.current = window.setInterval(async () => {
        try {
          const statusRes = await axios.get<{ status: string; data?: AnalysisData; message?: string }>(
            `${API_BASE_URL}/analysis/status/${resumeId}`
          );

          if (statusRes.data.status === 'COMPLETED') {
            setAnalysisResult(statusRes.data.data ?? null);
            setStatus('completed');
            if (pollingIntervalId.current) clearInterval(pollingIntervalId.current);
          } else if (statusRes.data.status === 'FAILED') {
            setErrorMessage(statusRes.data.message || 'Analysis failed on server.');
            setStatus('error');
            if (pollingIntervalId.current) clearInterval(pollingIntervalId.current);
          }
        } catch (err) {
          setErrorMessage('Could not get analysis status.');
          setStatus('error');
          if (pollingIntervalId.current) clearInterval(pollingIntervalId.current);
        }
      }, 3000);
    } catch (err) {
      setErrorMessage('File upload failed. Please try again.');
      setStatus('error');
    }
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'uploading': return 'Uploading file...';
      case 'analyzing': return 'Analyzing your resume... 🧠';
      case 'error': return `Error: ${errorMessage}`;
      default: return null;
    }
  };

  return (
    <div className="app-container">
      <h1>AI Resume Analyzer</h1>
      <input type="file" onChange={handleFileChange} accept=".pdf" />
      <button
        onClick={handleUploadAndAnalyze}
        disabled={!file || status === 'uploading' || status === 'analyzing'}
      >
        {status === 'uploading' || status === 'analyzing' ? 'Processing...' : 'Upload & Analyze'}
      </button>

      <div className="analysis-result">
        {status === 'completed' && analysisResult ? (
          <AnalysisDisplay result={analysisResult} />
        ) : (
          <p>{getStatusMessage()}</p>
        )}
      </div>
    </div>
  );
}

export default App;
