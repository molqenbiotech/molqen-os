import React, { useState, useRef } from 'react';
import { uploadToCloudinary } from '../utils/cloudinaryUpload';
import { playTactileClick, playSuccessChime } from '../utils/audioFeedback';
import { showToast } from '../utils/toast';

export default function BenchlingAttachmentDropzone({
  attachments = [],
  onChange,
  disabled = false,
  folder = 'molqen_lab_assets'
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const fileInputRef = useRef(null);

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setUploadProgress(0);

    const newAttachments = [...attachments];
    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const result = await uploadToCloudinary(file, {
          folder,
          onProgress: (percent) => {
            const overall = Math.round(((i + percent / 100) / files.length) * 100);
            setUploadProgress(overall);
          }
        });

        newAttachments.push(result);
        successCount++;
      } catch (err) {
        console.error('Cloudinary upload failure:', err);
        showToast(`Failed to upload ${file.name}: ${err.message}`, { type: 'error' });
      }
    }

    setIsUploading(false);
    setUploadProgress(0);

    if (successCount > 0) {
      playSuccessChime();
      onChange(newAttachments);
      showToast(
        `Uploaded & compressed ${successCount} scientific asset${successCount > 1 ? 's' : ''}`,
        { type: 'success', icon: '📸' }
      );
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleRemove = (idToRemove) => {
    playTactileClick();
    const updated = attachments.filter((att) => att.id !== idToRemove);
    onChange(updated);
    showToast('Attachment removed', { type: 'info', icon: '🗑️' });
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div style={{ marginTop: '12px' }}>
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.csv,.xlsx,.docx,.fasta"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
        }}
        disabled={disabled || isUploading}
      />

      {/* Benchling-Style Dropzone Box */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => {
          if (!disabled && !isUploading) {
            playTactileClick();
            fileInputRef.current?.click();
          }
        }}
        style={{
          border: `2px dashed ${dragActive ? '#059669' : '#CBD5E1'}`,
          backgroundColor: dragActive ? '#ECFDF5' : '#F8FAFC',
          borderRadius: '10px',
          padding: '16px 20px',
          textAlign: 'center',
          cursor: disabled || isUploading ? 'not-allowed' : 'pointer',
          transition: 'all 0.18s ease',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px'
        }}
      >
        <div style={{ fontSize: '24px' }}>
          {isUploading ? '⏳' : dragActive ? '📥' : '🧬'}
        </div>

        <div style={{ fontSize: '13px', fontWeight: '700', color: '#1B4332' }}>
          {isUploading
            ? `Compressing & Uploading to Cloudinary (${uploadProgress}%)...`
            : 'Drop gel electrophoresis images, raw spectra, or assay files'}
        </div>

        <div style={{ fontSize: '11px', color: '#64748B' }}>
          Automatic client-side canvas compression reduces storage by ~85% • PNG, JPG, WebP, PDF, CSV
        </div>

        {isUploading && (
          <div
            style={{
              width: '100%',
              maxWidth: '280px',
              height: '5px',
              backgroundColor: '#E2E8F0',
              borderRadius: '9999px',
              marginTop: '6px',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                width: `${uploadProgress}%`,
                height: '100%',
                backgroundColor: '#059669',
                transition: 'width 0.2s ease'
              }}
            />
          </div>
        )}
      </div>

      {/* Attachment Gallery Preview List */}
      {attachments.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '10px',
            marginTop: '12px'
          }}
        >
          {attachments.map((att) => {
            const isImage = att.resourceType === 'image' || att.thumbnailUrl;

            return (
              <div
                key={att.id}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                }}
              >
                {/* Image Thumbnail or File Icon */}
                <div
                  onClick={() => {
                    if (isImage) setPreviewImage(att.url);
                    else window.open(att.url, '_blank');
                  }}
                  style={{
                    height: '100px',
                    backgroundColor: '#F1F5F9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    position: 'relative'
                  }}
                  title="Click to view full-resolution asset"
                >
                  {isImage ? (
                    <img
                      src={att.thumbnailUrl || att.url}
                      alt={att.name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transition: 'transform 0.2s ease'
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: '32px' }}>📄</span>
                  )}

                  {att.savingsPercent > 0 && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '6px',
                        left: '6px',
                        fontSize: '9px',
                        fontWeight: '800',
                        backgroundColor: '#064E3B',
                        color: '#6EE7B7',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                      }}
                    >
                      -{att.savingsPercent}% Space Saved
                    </span>
                  )}
                </div>

                {/* File Details Bar */}
                <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      color: '#0F172A',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                    title={att.name}
                  >
                    {att.name}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: '#64748B' }}>
                    <span>{formatFileSize(att.compressedSize || att.originalSize)}</span>
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#059669', fontWeight: '700', textDecoration: 'none' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      Open ↗
                    </a>
                  </div>
                </div>

                {/* Remove Attachment Button */}
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(att.id);
                    }}
                    style={{
                      position: 'absolute',
                      top: '6px',
                      right: '6px',
                      background: 'rgba(15, 23, 42, 0.75)',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '50%',
                      width: '20px',
                      height: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      cursor: 'pointer',
                      backdropFilter: 'blur(4px)'
                    }}
                    title="Remove attachment"
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox Modal for Full-Resolution Viewing */}
      {previewImage && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100000,
            padding: '24px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '92vw',
              maxHeight: '90vh',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
              background: '#000000'
            }}
          >
            <img
              src={previewImage}
              alt="High-resolution scientific asset"
              style={{
                maxWidth: '92vw',
                maxHeight: '88vh',
                display: 'block',
                objectFit: 'contain'
              }}
            />
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: '#FFFFFF',
                color: '#0F172A',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                fontSize: '14px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

