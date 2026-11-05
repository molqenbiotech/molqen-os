import CryptoJS from 'crypto-js';

const DEFAULT_KEY = 'LABNEXUS_CORE_CIPHER_2026';

export function encryptData(data, secretKey = DEFAULT_KEY) {
  if (!data) return '';
  try {
    const text = typeof data === 'object' ? JSON.stringify(data) : String(data);
    return CryptoJS.AES.encrypt(text, secretKey).toString();
  } catch (error) {
    console.error('Encryption error:', error);
    return data;
  }
}

export function decryptData(cipherText, secretKey = DEFAULT_KEY) {
  if (!cipherText) return '';
  try {
    if (typeof cipherText !== 'string' || !cipherText.startsWith('U2FsdGVkX1')) {
      return cipherText;
    }
    const bytes = CryptoJS.AES.decrypt(cipherText, secretKey);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    try {
      return JSON.parse(decrypted);
    } catch {
      return decrypted;
    }
  } catch (error) {
    console.warn('Decryption fallback:', error);
    return cipherText;
  }
}