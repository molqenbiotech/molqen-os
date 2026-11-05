/**
 * MOLQEN OS — Cloudinary High-Efficiency Storage & Compression Service
 * Benchling-grade scientific asset management for gel electrophoresis scans,
 * microscope images, assay spectra, and protocol attachments.
 */

export const CLOUDINARY_CLOUD_NAME =
  import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'k4qswf4f';
export const CLOUDINARY_UPLOAD_PRESET =
  import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'molqen_uploads';

/**
 * Compresses an image client-side via HTML5 Canvas before uploading
 * Reduces file sizes by 70–90% while preserving sharp band resolution for electrophoresis & blots.
 *
 * @param {File} file - Original user-selected file
 * @param {Object} [options]
 * @param {number} [options.maxWidth=1920] - Maximum dimension for high-res retention
 * @param {number} [options.maxHeight=1920]
 * @param {number} [options.quality=0.82] - Perceptual quality compression
 * @returns {Promise<{ blob: Blob, originalSize: number, compressedSize: number, savingsPercent: number }>}
 */
export async function compressImageClientSide(
  file,
  { maxWidth = 1920, maxHeight = 1920, quality = 0.82 } = {}
) {
  // If not an image, return raw file without canvas compression
  if (!file.type.startsWith('image/')) {
    return {
      blob: file,
      originalSize: file.size,
      compressedSize: file.size,
      savingsPercent: 0
    };
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Maintain aspect ratio while scaling down
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({
            blob: file,
            originalSize: file.size,
            compressedSize: file.size,
            savingsPercent: 0
          });
          return;
        }

        // Draw image with smooth bicubic scaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to WebP or JPEG
        const outputMime = file.type === 'image/png' ? 'image/webp' : 'image/jpeg';
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve({
                blob: file,
                originalSize: file.size,
                compressedSize: file.size,
                savingsPercent: 0
              });
              return;
            }

            const originalSize = file.size;
            const compressedSize = blob.size;
            const savingsPercent = Math.max(
              0,
              Math.round(((originalSize - compressedSize) / originalSize) * 100)
            );

            resolve({
              blob,
              originalSize,
              compressedSize,
              savingsPercent
            });
          },
          outputMime,
          quality
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads a file to Cloudinary with automated pre-compression
 *
 * @param {File} file
 * @param {Object} [options]
 * @param {Function} [options.onProgress] - Optional progress callback (percent 0-100)
 * @param {string} [options.folder='molqen_lab_assets']
 * @returns {Promise<Object>} Attachment metadata
 */
export async function uploadToCloudinary(
  file,
  { onProgress, folder = 'molqen_lab_assets' } = {}
) {
  const cloudName = CLOUDINARY_CLOUD_NAME;
  const uploadPreset = CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error(
      'Missing Cloudinary configuration. Please ensure VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET are set.'
    );
  }

  // 1. Client-side compression
  const compressionResult = await compressImageClientSide(file);
  const uploadPayload = compressionResult.blob;

  // 2. Prepare FormData
  const formData = new FormData();
  formData.append('file', uploadPayload, file.name);
  formData.append('upload_preset', uploadPreset);
  formData.append('folder', folder);

  // 3. Perform upload with XMLHttpRequest to support progress telemetry
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      'POST',
      `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`
    );

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);

          // Generate optimized thumbnail URL via Cloudinary transformations
          let thumbnailUrl = data.secure_url;
          if (data.resource_type === 'image') {
            thumbnailUrl = data.secure_url.replace(
              '/upload/',
              '/upload/c_thumb,w_300,h_200,g_auto,q_auto,f_auto/'
            );
          }

          resolve({
            id: data.public_id || 'att_' + Date.now(),
            name: file.name,
            originalSize: compressionResult.originalSize,
            compressedSize: compressionResult.compressedSize,
            savingsPercent: compressionResult.savingsPercent,
            url: data.secure_url,
            thumbnailUrl,
            format: data.format || file.name.split('.').pop(),
            resourceType: data.resource_type || 'raw',
            uploadedAt: new Date().toISOString()
          });
        } catch (parseErr) {
          reject(parseErr);
        }
      } else {
        try {
          const errData = JSON.parse(xhr.responseText);
          reject(new Error(errData.error?.message || `Upload failed with status ${xhr.status}`));
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error occurred during Cloudinary upload.'));
    };

    xhr.send(formData);
  });
}

