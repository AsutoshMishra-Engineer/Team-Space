import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export default function SharedFiles({ teamId, isLeader }) {
  const { user } = useAuth();
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [previewFile, setPreviewFile] = useState(null); // Preview modal state
  const [previewLoading, setPreviewLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const fileInputRef = useRef(null);

  const formatSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileCategory = (filename = '') => {
    const ext = filename.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
    if (['pdf'].includes(ext)) return 'pdf';
    if (['doc', 'docx', 'txt', 'md'].includes(ext)) return 'document';
    if (['zip', 'rar', 'tar', '7z', 'gz'].includes(ext)) return 'archive';
    if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return 'video';
    if (['mp3', 'wav', 'ogg'].includes(ext)) return 'audio';
    if (['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'html', 'css', 'json'].includes(ext)) return 'code';
    return 'other';
  };

  const getFileIcon = (category) => {
    switch (category) {
      case 'image': return '🖼️';
      case 'pdf': return '📕';
      case 'document': return '📝';
      case 'archive': return '🗜️';
      case 'video': return '🎬';
      case 'audio': return '🎵';
      case 'code': return '💻';
      default: return '📄';
    }
  };

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('team_files')
        .select('*, profiles!team_files_profiles_fkey(user_id, username)')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFiles(data || []);
    } catch (err) {
      console.error('Error fetching files:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (teamId) fetchFiles();
  }, [teamId]);

  // Keyboard shortcut: close preview on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && previewFile) {
        setPreviewFile(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewFile]);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      alert('File too large! Maximum 25MB allowed.');
      e.target.value = null;
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      let fileUrl = '';
      let storagePath = '';

      if (CLOUD_NAME && CLOUD_NAME !== 'YOUR_CLOUD_NAME_HERE') {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', UPLOAD_PRESET);
        formData.append('folder', `teamspace/${teamId}`);

        const xhr = new XMLHttpRequest();
        const uploadPromise = new Promise((resolve, reject) => {
          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              setUploadProgress(Math.round((event.loaded / event.total) * 100));
            }
          });
          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(JSON.parse(xhr.responseText));
            } else {
              reject(new Error('Upload failed'));
            }
          });
          xhr.addEventListener('error', () => reject(new Error('Upload failed')));
          xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`);
          xhr.send(formData);
        });

        const result = await uploadPromise;
        fileUrl = result.secure_url;
        storagePath = result.public_id;
      } else {
        const path = `${teamId}/${crypto.randomUUID()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('team-files')
          .upload(path, file);

        if (uploadError) throw uploadError;
        storagePath = path;
      }

      const { error: dbError } = await supabase
        .from('team_files')
        .insert({
          team_id: teamId,
          uploaded_by: user.id,
          file_name: file.name,
          storage_path: storagePath,
          file_url: fileUrl,
          file_size: file.size
        });

      if (dbError) throw dbError;
      fetchFiles();
    } catch (err) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      e.target.value = null;
    }
  };

  const getFileAccessUrl = async (fileRecord) => {
    if (fileRecord.file_url) return fileRecord.file_url;
    const { data, error } = await supabase.storage
      .from('team-files')
      .createSignedUrl(fileRecord.storage_path, 300);
    if (error) throw error;
    return data.signedUrl;
  };

  const handleDownload = async (fileRecord) => {
    try {
      setDownloadingId(fileRecord.id);
      const url = await getFileAccessUrl(fileRecord);
      const fileName = fileRecord.file_name || 'download';

      // 1. Fetch as blob to trigger true native browser download
      try {
        const response = await fetch(url);
        if (response.ok) {
          const blob = await response.blob();
          const blobUrl = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = blobUrl;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            window.URL.revokeObjectURL(blobUrl);
            if (document.body.contains(a)) document.body.removeChild(a);
          }, 2000);
          return;
        }
      } catch (fetchErr) {
        console.warn('Direct blob fetch download fallback:', fetchErr);
      }

      // 2. Direct anchor click fallback
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (document.body.contains(link)) document.body.removeChild(link);
      }, 1000);
    } catch (err) {
      alert(`Download failed: ${err.message}`);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleOpenPreview = async (fileRecord) => {
    try {
      setPreviewLoading(true);
      const url = await getFileAccessUrl(fileRecord);
      const cat = getFileCategory(fileRecord.file_name);

      let textContent = null;
      // If text or code file, fetch the content so user can read/preview it inline!
      const isText = /\.(txt|md|json|js|jsx|ts|tsx|py|html|css|sql|env|csv|xml|log|yaml|yml)$/i.test(fileRecord.file_name);
      if (isText) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            textContent = await res.text();
            if (textContent.length > 250000) {
              textContent = textContent.slice(0, 250000) + '\n\n...[Content truncated for preview]';
            }
          }
        } catch (e) {
          console.warn('Could not fetch text content for preview:', e);
        }
      }

      setPreviewFile({
        ...fileRecord,
        resolvedUrl: url,
        category: cat,
        textContent,
        isText
      });
    } catch (err) {
      alert(`Preview failed: ${err.message}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDelete = async (fileRecord) => {
    if (!window.confirm(`Delete "${fileRecord.file_name}"?`)) return;

    try {
      if (!fileRecord.file_url && fileRecord.storage_path) {
        await supabase.storage
          .from('team-files')
          .remove([fileRecord.storage_path]);
      }

      const { error: dbError } = await supabase
        .from('team_files')
        .delete()
        .eq('id', fileRecord.id);

      if (dbError) throw dbError;
      setFiles((prev) => prev.filter((f) => f.id !== fileRecord.id));
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  // Filter and search files
  const filteredFiles = (files || []).filter((f) => {
    if (!f) return false;
    const name = f.file_name || '';
    const matchesSearch = name.toLowerCase().includes((searchTerm || '').toLowerCase());
    const category = getFileCategory(name);
    const matchesFilter = filterType === 'all' || category === filterType;
    return matchesSearch && matchesFilter;
  });

  const totalBytes = (files || []).reduce((acc, f) => acc + (f?.file_size || 0), 0);

  return (
    <div className="pro-files-hub">
      {/* Top Header Card */}
      <div className="pro-files-header">
        <div className="pro-files-title-group">
          <div className="pro-files-icon-box">📂</div>
          <div>
            <h2 className="pro-files-title">Shared Team Drive</h2>
            <p className="pro-files-subtitle">
              {files.length} file{files.length === 1 ? '' : 's'} · {formatSize(totalBytes)} used · Cloud Storage
            </p>
          </div>
        </div>

        <div className="pro-files-action-group">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="pro-upload-btn"
          >
            {uploading ? (
              <>
                <span className="wa-send-spinner"></span>
                Uploading {uploadProgress}%
              </>
            ) : (
              <>
                <span>☁️</span> Upload File
              </>
            )}
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {uploading && (
        <div className="pro-upload-tracker">
          <div className="pro-tracker-info">
            <span>Uploading your file to Cloud Storage...</span>
            <span className="pro-tracker-pct">{uploadProgress}%</span>
          </div>
          <div className="pro-tracker-bar">
            <div
              className="pro-tracker-fill"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="pro-files-toolbar">
        <div className="pro-search-box">
          <span className="pro-search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search files by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pro-search-input"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="pro-search-clear"
            >
              ✕
            </button>
          )}
        </div>

        <div className="pro-filter-chips">
          {['all', 'document', 'image', 'pdf', 'archive', 'code'].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`pro-chip ${filterType === type ? 'pro-chip-active' : ''}`}
            >
              {type === 'all' ? 'All Files' : type.charAt(0).toUpperCase() + type.slice(1) + 's'}
            </button>
          ))}
        </div>
      </div>

      {/* File List / Grid */}
      {loading ? (
        <div className="pro-files-loading">
          <span className="wa-send-spinner" style={{ width: '24px', height: '24px' }}></span>
          <p>Loading files...</p>
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="pro-files-empty">
          <div className="pro-empty-art">📁</div>
          <h3>{searchTerm || filterType !== 'all' ? 'No matching files found' : 'No files in this workspace'}</h3>
          <p>
            {searchTerm || filterType !== 'all'
              ? 'Try adjusting your search terms or filters.'
              : 'Upload project assets, documents, images, and notes to share with your team.'}
          </p>
          {!searchTerm && filterType === 'all' && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-secondary btn-small mt-2"
            >
              Upload First File
            </button>
          )}
        </div>
      ) : (
        <div className="pro-files-grid">
          {filteredFiles.map((file) => {
            const cat = getFileCategory(file.file_name);
            const icon = getFileIcon(cat);
            const uploaderName = file.profiles?.username || file.profiles?.user_id || 'Teammate';
            const uploadDate = new Date(file.created_at).toLocaleDateString([], {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            });

            return (
              <div key={file.id} className="pro-file-card">
                <div className="pro-file-card-top">
                  {cat === 'image' && file.file_url ? (
                    <div
                      className="pro-file-thumb-container"
                      onClick={() => handleOpenPreview(file)}
                      title="Click to preview image"
                    >
                      <img src={file.file_url} alt={file.file_name} className="pro-file-thumb-img" loading="lazy" />
                      <span className="pro-file-thumb-badge">👁️ Preview</span>
                    </div>
                  ) : (
                    <div
                      className="pro-file-badge"
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleOpenPreview(file)}
                      title="Click to preview file"
                    >
                      {icon}
                    </div>
                  )}
                  <div className="pro-file-tags">
                    <span className="pro-file-cat-pill">{cat.toUpperCase()}</span>
                  </div>
                </div>

                <div className="pro-file-body">
                  <div
                    className="pro-file-title"
                    title={file.file_name}
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleOpenPreview(file)}
                  >
                    {file.file_name}
                  </div>
                  <div className="pro-file-meta">
                    <span>{formatSize(file.file_size)}</span>
                    <span className="pro-dot-sep">•</span>
                    <span>{uploadDate}</span>
                  </div>
                  <div className="pro-file-uploader">
                    👤 <strong>{uploaderName}</strong>
                  </div>
                </div>

                <div className="pro-file-actions">
                  <button
                    onClick={() => handleOpenPreview(file)}
                    className="pro-btn-preview"
                    title="Preview file"
                  >
                    👁️ Preview
                  </button>

                  <button
                    onClick={() => handleDownload(file)}
                    disabled={downloadingId === file.id}
                    className="pro-btn-download"
                    title="Download file"
                  >
                    {downloadingId === file.id ? '⏳' : '⬇️'}
                  </button>

                  {(file.uploaded_by === user.id || isLeader) && (
                    <button
                      onClick={() => handleDelete(file)}
                      className="pro-btn-delete"
                      title="Delete file"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* WhatsApp-Style File Preview Modal */}
      {previewFile && (
        <div
          className="wa-preview-overlay"
          onClick={(e) => e.target === e.currentTarget && setPreviewFile(null)}
        >
          <div className="wa-preview-modal">
            <div className="wa-preview-topbar">
              <div className="wa-preview-info">
                <span className="wa-preview-icon">{getFileIcon(previewFile.category)}</span>
                <div>
                  <h4 className="wa-preview-filename">{previewFile.file_name}</h4>
                  <span className="wa-preview-sub">
                    {formatSize(previewFile.file_size)} · Uploaded by <strong>{previewFile.profiles?.username || previewFile.profiles?.user_id || 'Teammate'}</strong> on {new Date(previewFile.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              </div>

              <div className="wa-preview-buttons">
                <a
                  href={previewFile.resolvedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-small"
                  style={{ fontSize: '0.78rem', padding: '6px 12px', whiteSpace: 'nowrap' }}
                  title="Open file directly in new tab"
                >
                  ↗️ Open in Tab
                </a>
                <button
                  onClick={() => handleDownload(previewFile)}
                  disabled={downloadingId === previewFile.id}
                  className="wa-preview-action-btn"
                  title="Download File"
                >
                  {downloadingId === previewFile.id ? '⏳ Downloading...' : '⬇️ Download'}
                </button>
                <button
                  onClick={() => setPreviewFile(null)}
                  className="wa-preview-close-btn"
                  title="Close Preview (Esc)"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="wa-preview-viewport">
              {previewFile.category === 'image' ? (
                <div className="wa-preview-image-wrapper">
                  <img
                    src={previewFile.resolvedUrl}
                    alt={previewFile.file_name}
                    className="wa-preview-img"
                  />
                </div>
              ) : previewFile.category === 'video' ? (
                <div className="wa-preview-video-wrapper">
                  <video
                    src={previewFile.resolvedUrl}
                    controls
                    autoPlay
                    playsInline
                    className="wa-preview-video"
                  />
                </div>
              ) : previewFile.category === 'audio' ? (
                <div className="wa-preview-audio-card">
                  <span style={{ fontSize: '3.8rem', display: 'block', marginBottom: '1rem' }}>🎵</span>
                  <h4 style={{ color: '#fff', marginBottom: '0.5rem', fontSize: '1.05rem' }}>{previewFile.file_name}</h4>
                  <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '1.25rem' }}>Audio playback preview</p>
                  <audio src={previewFile.resolvedUrl} controls autoPlay style={{ width: '100%' }} />
                </div>
              ) : previewFile.textContent !== null ? (
                <div className="wa-preview-code-card">
                  <div className="wa-preview-code-toolbar">
                    <span>Text / Code Preview ({formatSize(previewFile.file_size)})</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(previewFile.textContent);
                        alert('Copied text to clipboard!');
                      }}
                      className="btn btn-secondary btn-small"
                      style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                    >
                      📋 Copy All
                    </button>
                  </div>
                  <pre className="wa-preview-code-content">{previewFile.textContent}</pre>
                </div>
              ) : previewFile.category === 'pdf' || previewFile.category === 'document' ? (
                <div className="wa-preview-pdf-wrapper">
                  <div className="wa-pdf-preview-header">
                    <span className="wa-pdf-tag">📕 Document Inspection</span>
                    <span className="wa-pdf-note">Review document contents before downloading to your device</span>
                    <a
                      href={previewFile.resolvedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-small"
                      style={{ fontSize: '0.74rem', padding: '3px 10px' }}
                    >
                      ↗️ Full View
                    </a>
                  </div>
                  <iframe
                    src={`https://docs.google.com/viewer?url=${encodeURIComponent(previewFile.resolvedUrl)}&embedded=true`}
                    title={previewFile.file_name}
                    className="wa-preview-iframe"
                  />
                </div>
              ) : (
                <div className="wa-preview-generic">
                  <span style={{ fontSize: '3.8rem' }}>{getFileIcon(previewFile.category)}</span>
                  <h3>{previewFile.file_name}</h3>
                  <p>{formatSize(previewFile.file_size)} · This file format cannot be displayed directly in the browser viewport. Click below to inspect or download it to your device.</p>
                  <button
                    onClick={() => handleDownload(previewFile)}
                    disabled={downloadingId === previewFile.id}
                    className="btn btn-primary"
                    style={{ marginTop: '1.25rem', padding: '8px 20px', fontWeight: 700 }}
                  >
                    {downloadingId === previewFile.id ? '⏳ Downloading...' : '⬇️ Download File'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
