/**
 * MOLQEN OS — Cloudinary Hybrid Storage Service
 * Handles client-side media uploads for gel scans, brightfield microscopy,
 * plate photos, and protocol attachments.
 */

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'k4qswf4f';
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'molqen_uploads';

/**
 * Uploads a file (image, gel scan, PDF, data sheet) directly to Cloudinary via unsigned upload.
 *
 * @param {File|Blob} file - The file to upload.
 * @param {string} [folder='molqen_lab_evidence'] - Target folder namespace in Cloudinary.
 * @returns {Promise<{ url: string, secure_url: string, public_id: string, bytes: number, format: string }>}
 */
export async function uploadLabMedia(file, folder = 'molqen_lab_evidence') {
  if (!file) throw new Error('No file provided for upload.');

  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    console.warn('Cloudinary credentials missing, using local object URL fallback.');
    const localUrl = URL.createObjectURL(file);
    return {
      url: localUrl,
      secure_url: localUrl,
      public_id: 'local_' + Date.now(),
      bytes: file.size || 0,
      format: file.type?.split('/')[1] || 'bin'
    };
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);
  if (folder) formData.append('folder', folder);

  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Upload failed with HTTP ${res.status}`);
    }

    const data = await res.json();
    return {
      url: data.url,
      secure_url: data.secure_url,
      public_id: data.public_id,
      bytes: data.bytes,
      format: data.format
    };
  } catch (err) {
    console.warn('Cloudinary network upload failed, providing local object URL fallback:', err);
    const localUrl = URL.createObjectURL(file);
    return {
      url: localUrl,
      secure_url: localUrl,
      public_id: 'local_fallback_' + Date.now(),
      bytes: file.size || 0,
      format: file.type?.split('/')[1] || 'bin'
    };
  }
}

