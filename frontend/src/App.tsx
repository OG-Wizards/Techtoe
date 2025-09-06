import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

// --- Type definition for our AI analysis result ---
interface AnalysisData {
  summary: string;
  strengths: string[];
  areasForImprovement: string[];
  overallScore: number;
}

// --- A new component to display the detailed results ---
const AnalysisDisplay: React.FC<{ result: AnalysisData }> = ({ result }) => (
  <div className="analysis-result">
    <h3>Analysis Complete!</h3>
    <p><strong>Summary:</strong> {result.summary}</p>
    <div>
      <h4>Strengths: ✅</h4>
      <ul>{result.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
    </div>
    <div>
      <h4>Areas for Improvement: 💡</h4>
      <ul>{result.areasForImprovement.map((i, idx) => <li key={idx}>{idx}</li>)}</ul>
    </div>
    <p><strong>Overall Score:</strong> {result.overallScore} / 100</p>
  </div>
);

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'analyzing' | 'completed' | 'error'>('idle');
  const [analysisResult, setAnalysisResult] = useState<AnalysisData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  // Using React's ref to hold the interval ID to avoid state-related issues
  const pollingIntervalId = React.useRef<number | null>(null);

  const API_BASE_URL = 'http://localhost:8080'; // Your backend URL

  // Cleanup interval on component unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalId.current) {
        clearInterval(pollingIntervalId.current);
      }
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
      // Reset state when a new file is chosen
      setStatus('idle');
      setAnalysisResult(null);
      setErrorMessage('');
      if (pollingIntervalId.current) {
        clearInterval(pollingIntervalId.current);
      }
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
      // Step 1: Upload the file to get a resumeId
      const uploadRes = await axios.post<{ resumeId: string }>(`${API_BASE_URL}/upload`, formData);
      const { resumeId } = uploadRes.data;

      // Step 2: Start the analysis workflow
      await axios.post(`${API_BASE_URL}/analyze`, { resumeId });
      setStatus('analyzing');

      // Step 3: Start polling for the result
      pollingIntervalId.current = window.setInterval(async () => {
        try {
          const statusRes = await axios.get<{ status: string; data?: AnalysisData; message?: string }>(`${API_BASE_URL}/analysis/status/${resumeId}`);
          
          if (statusRes.data.status === 'COMPLETED') {
            setAnalysisResult(statusRes.data.data ?? null);
            setStatus('completed');
            if (pollingIntervalId.current) clearInterval(pollingIntervalId.current);
          } else if (statusRes.data.status === 'FAILED') {
            setErrorMessage(statusRes.data.message || 'Analysis failed on the server.');
            setStatus('error');
            if (pollingIntervalId.current) clearInterval(pollingIntervalId.current);
          }
          // If status is 'PENDING', do nothing and let the interval run again
        } catch (err) {
          setErrorMessage('Could not get analysis status.');
          setStatus('error');
          if (pollingIntervalId.current) clearInterval(pollingIntervalId.current);
        }
      }, 3000); // Poll every 3 seconds

    } catch (err) {
      setErrorMessage('File upload failed. Please try again.');
      setStatus('error');
    }
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'uploading':
        return 'Uploading file...';
      case 'analyzing':
        return 'Analyzing your resume... This may take a moment. 🧠';
      case 'error':
        return `Error: ${errorMessage}`;
      default:
        return null; // Don't show a message for idle or completed
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
        {/* Show detailed results if complete, otherwise show status message */}
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