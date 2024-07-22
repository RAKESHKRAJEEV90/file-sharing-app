// App.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import ErrorModal from './ErrorModal';
import localforage from 'localforage';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL; // Change to your backend URL

function App() {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [localFiles, setLocalFiles] = useState([]);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fileToDownload, setFileToDownload] = useState(null);
  const [error, setError] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const fileInputRef = useRef(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [cancelTokenSource, setCancelTokenSource] = useState(null);


  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };
  const fetchFiles = async () => {
    try {
      const response = await axios.get(`${API_URL}/files`);
      setFiles(response.data);
    } catch (error) {
      console.error('Error fetching files:', error);
    }
  };

  const fetchLocalFiles = async () => {
    const items = [];
    await localforage.iterate((file, key) => {
      items.push({ name: key, file });
    });
    setLocalFiles(items);
  };

  const syncFilesToBackend = useCallback(async () => {
    try {
      await axios.get(`${API_URL}`);

      localforage.iterate(async (file, key) => {
        const formData = new FormData();
        formData.append('file', file);

        try {
          await axios.post(`${API_URL}/upload`, formData);
          console.log('File uploaded to backend:', key);
          await localforage.removeItem(key);
          console.log('File removed from local storage:', key);
          fetchFiles();
          fetchLocalFiles();
        } catch (error) {
          console.error('Error uploading file to backend:', error);
        }
      });
    } catch (error) {
      console.error('Backend is offline:', error);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
    fetchLocalFiles();
  }, []);

  useEffect(() => {
    syncFilesToBackend();
  }, [syncFilesToBackend]);

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      await localforage.setItem(selectedFile.name, selectedFile);
      console.log('File saved locally:', selectedFile.name);
      setSelectedFile(null);
      fetchLocalFiles();
      syncFilesToBackend();
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error saving file locally:', error);
    }
  };

  const handleRemoveFile = async (fileName) => {
    try {
      await localforage.removeItem(fileName);
      console.log('File removed from local storage:', fileName);
      fetchLocalFiles();
    } catch (error) {
      console.error('Error removing file from local storage:', error);
    }
  };

  const handleDownload = (fileName) => {
    setFileToDownload(fileName);
    setIsModalOpen(true);
    setError(null); // Clear any previous errors
  };


  const downloadFile = async (fileName, password) => {
    setIsDownloading(true);
    setDownloadProgress(0);
  
    // Create a new CancelToken source
    const source = axios.CancelToken.source();
    setCancelTokenSource(source);
  
    try {
      const response = await axios.get(`${API_URL}/check-password`, {
        params: { fileName, password }
      });
  
      if (response.data.valid === true) {
        const downloadResponse = await axios.get(`${API_URL}/download/${fileName}`, {
          responseType: 'blob',
          cancelToken: source.token,
          onDownloadProgress: (progressEvent) => {
            const percent = Math.floor((progressEvent.loaded * 100) / progressEvent.total);
            setIsModalOpen(false); // Close the password modal
            setPassword('');
            setDownloadProgress(percent);
          },
        });
  
        if (downloadResponse.status === 200) {
          const url = window.URL.createObjectURL(new Blob([downloadResponse.data]));
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', fileName);
          document.body.appendChild(link);
          link.click();
          link.parentNode.removeChild(link);
  
          setIsModalOpen(false); // Close the password modal
          setPassword('');
        } else {
          throw new Error('Failed to download file. Status: ' + downloadResponse.status);
        }
      } else {
        throw new Error('Incorrect password. Please try again.');
      }
    } catch (error) {
      if (axios.isCancel(error)) {
        console.log('Download canceled:', error.message);
      } else {
        console.error('Error downloading file:', error);
        setError(error.message);
      }
    } finally {
      setIsDownloading(false);
    }
  };
  

const cancelDownload = () => {
  if (cancelTokenSource) {
    cancelTokenSource.cancel('Download canceled by user.');
  }
  setIsDownloading(false);
  setDownloadProgress(0);
};

  
  const handleModalSubmit = () => {
    if (fileToDownload && password) {
      downloadFile(fileToDownload, password);
    } else {
      setError('Please enter a password.');
    }
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  return (
    <div className="app-wrapper">
    <div className={`App ${darkMode ? 'dark-mode' : ''}`}>
      <div className="header">
        <h1>RK's Cloud</h1>
        <button className="mode-toggle" onClick={toggleDarkMode}>
          {darkMode ? '☀️' : '🌙'}
        </button>
      </div>
      <div className="file-upload-container">
        <label className="file-input-label">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          Choose File
          <input type="file" onChange={handleFileChange} ref={fileInputRef} style={{ display: 'none' }} />
        </label>
        <button onClick={handleUpload}>Upload</button>
      </div>
      {selectedFile && (
        <p className="chosen-file">Selected file: {selectedFile.name}</p>
      )}
      <h2>Uploaded Files</h2>
      <ul>
        {files.map((file, index) => (
          <li key={index}>
            <div className="file-item">
              <svg className="file-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                <polyline points="13 2 13 9 20 9"></polyline>
              </svg>
              <span className="file-name">{file}</span>
            </div>
            <button className="download-button" onClick={() => handleDownload(file)}>Download</button>
          </li>
        ))}
      </ul>
      <h2>Local Files (Pending Upload)</h2>
      <ul>
        {localFiles.map((localFile, index) => (
          <li key={index}>
            <div className="file-item">
              <svg className="file-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                <polyline points="13 2 13 9 20 9"></polyline>
              </svg>
              <span className="file-name">{localFile.name}</span>
            </div>
            <button onClick={() => handleRemoveFile(localFile.name)}>Remove</button>
          </li>
        ))}
      </ul>
      <footer className="footer">
        <div className="footer-content">
          <p>&copy; 2024 RK Cloud. All rights reserved.</p>
          <div className="donation-buttons">
            <a href="https://www.buymeacoffee.com/rk_dev" target="_blank" rel="noopener noreferrer" className="donation-button coffee-button">
              <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" />
            </a>
            <a href="https://paypal.me/rkdevz?country.x=IN&locale.x=en_GB" target="_blank" rel="noopener noreferrer" className="donation-button paypal-button">
              <img src="https://www.paypalobjects.com/webstatic/en_US/i/buttons/PP_logo_h_100x26.png" alt="PayPal" />
              <span>Donate</span>
            </a>
          </div>
        </div>
      </footer>
      {isModalOpen && (
        <div className="modal">
          <div className="modal-content">
            <span className="close" onClick={() => { setIsModalOpen(false); setPassword(''); setError(null); }}>&times;</span>
            <p>Please enter password:</p>
            {error && <p className="error-message">{error}</p>}
            <div className="password-input-container">
  <input
    type={showPassword ? "text" : "password"}
    value={password}
    onChange={(e) => setPassword(e.target.value)}
    placeholder="Enter password"
  />
  <button id='toggle-password-eye'
    className="toggle-password-visibility" 
    onClick={togglePasswordVisibility}
    type="button"
    aria-label={showPassword ? "Hide password" : "Show password"}
  >
    {showPassword ? (
      <svg viewBox="0 0 24 24">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
    ) : (
      <svg viewBox="0 0 24 24" transform="translate(0, 1)">
  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
  <line x1="2" y1="2" x2="22" y2="22"></line>
</svg>
    )}
  </button>
</div>
            <button onClick={handleModalSubmit}>Submit</button>
          </div>
        </div>
      )}
{isDownloading && (
  <div className="download-status-modal">
    <div className="download-status-content">
      <button className="close-modal" onClick={() => cancelDownload()}>×</button>
      <h3>Downloading File</h3>
      <div className="progress-bar-container">
        <div 
          className="progress-bar" 
          style={{width: `${downloadProgress}%`}}
        ></div>
      </div>
      <p>{downloadProgress}% Complete</p>
      <button className="cancel-download" onClick={() => cancelDownload()}>
        Cancel
      </button>
    </div>
  </div>
)}

      {error && (
        <ErrorModal 
          message={error} 
          onClose={() => setError(null)} 
        />
      )}
    </div>
  </div>
  );
}

export default App;