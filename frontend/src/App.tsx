import React, { useState } from 'react';
import './App.css';

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return;

    const formData = new FormData();
    formData.append('resume', file);

    try {
      const res = await fetch('http://localhost:8080/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      setAnalysis(data.analysis);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="app-container">
      <h1>AI Resume Analyzer</h1>
      <input type="file" onChange={handleFileChange} accept=".pdf" />
      <button onClick={handleUpload}>Upload & Analyze</button>

      {analysis && (
        <div className="analysis-result">
          <p><strong>Word Count:</strong> {analysis.wordCount}</p>
          <p><strong>Score:</strong> {analysis.score}</p>
        </div>
      )}
    </div>
  );
}

export default App;
