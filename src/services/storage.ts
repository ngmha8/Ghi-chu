import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getStorage,
  ref,
  uploadBytes,
  uploadBytesResumable,
  uploadString,
  getDownloadURL,
  deleteObject,
  getMetadata,
  FirebaseStorage,
  UploadTaskSnapshot,
} from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Storage instance
let storageInstance: FirebaseStorage | null = null;

/**
 * Retrieves the singleton Firebase Cloud Storage instance
 */
export function getFirebaseStorage(): FirebaseStorage {
  if (!storageInstance) {
    const bucket = firebaseConfig.storageBucket;
    const bucketUrl = bucket
      ? (bucket.startsWith('gs://') ? bucket : `gs://${bucket}`)
      : undefined;
    storageInstance = getStorage(app, bucketUrl);
  }
  return storageInstance;
}

export interface StorageUploadResult {
  downloadUrl: string;
  storagePath: string;
  fileName: string;
  size: number;
  mimeType: string;
  storageType: 'gcs';
}

export interface UploadOptions {
  folder?: string;
  customFileName?: string;
  metadata?: Record<string, string>;
  onProgress?: (progressPercent: number, snapshot: UploadTaskSnapshot) => void;
}

/**
 * Checks whether Google Cloud Storage (GCS) bucket is configured in firebase-applet-config.json
 */
export function isCloudStorageConfigured(): boolean {
  return !!(firebaseConfig.storageBucket && firebaseConfig.storageBucket.trim().length > 0);
}

/**
 * Returns the configured Google Cloud Storage bucket name
 */
export function getStorageBucketName(): string {
  return firebaseConfig.storageBucket || '';
}

/**
 * Uploads a File or Blob directly to Google Cloud Storage (GCS) via Firebase Storage.
 * Replaces container ephemeral storage with persistent cloud object storage.
 *
 * @param file The File or Blob to upload
 * @param options Upload options including target folder, custom filename, metadata, and progress callback
 * @returns Result object containing permanent downloadUrl, storagePath, and file metadata
 */
export async function uploadFileToStorage(
  file: File | Blob,
  options: UploadOptions = {}
): Promise<StorageUploadResult> {
  const storage = getFirebaseStorage();
  const folder = options.folder || 'documents';
  const originalName = (file as File).name || 'file.bin';
  const cleanName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fileName = options.customFileName || `${Date.now()}_${cleanName}`;
  const storagePath = `${folder}/${fileName}`;
  const storageRef = ref(storage, storagePath);

  const customMetadata: Record<string, string> = {
    originalName: originalName,
    uploadedAt: new Date().toISOString(),
    ...(options.metadata || {}),
  };

  const fileType = file.type || 'application/octet-stream';

  // Use uploadBytesResumable if progress reporting is requested
  if (options.onProgress) {
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: fileType,
      customMetadata,
    });

    await new Promise<void>((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          options.onProgress?.(percent, snapshot);
        },
        (error) => {
          console.error('[GCS Storage] Resumable upload failed:', error);
          reject(error);
        },
        () => {
          resolve();
        }
      );
    });
  } else {
    await uploadBytes(storageRef, file, {
      contentType: fileType,
      customMetadata,
    });
  }

  // Retrieve permanent download URL
  const downloadUrl = await getDownloadURL(storageRef);

  return {
    downloadUrl,
    storagePath,
    fileName: originalName,
    size: file.size,
    mimeType: fileType,
    storageType: 'gcs',
  };
}

/**
 * Uploads base64 encoded data directly to Google Cloud Storage (GCS) via Firebase Storage
 *
 * @param base64Data Base64 encoded string or Data URL
 * @param fileName Target filename
 * @param mimeType MIME type of the file
 * @param folder Target folder in bucket (defaults to 'documents')
 */
export async function uploadBase64ToStorage(
  base64Data: string,
  fileName: string,
  mimeType = 'application/octet-stream',
  folder = 'documents'
): Promise<StorageUploadResult> {
  const storage = getFirebaseStorage();
  const cleanBase64 = base64Data.replace(/^data:.*?;base64,/, '');
  const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const targetFileName = `${Date.now()}_${cleanName}`;
  const storagePath = `${folder}/${targetFileName}`;
  const storageRef = ref(storage, storagePath);

  await uploadString(storageRef, cleanBase64, 'base64', {
    contentType: mimeType,
    customMetadata: {
      originalName: fileName,
      uploadedAt: new Date().toISOString(),
    },
  });

  const downloadUrl = await getDownloadURL(storageRef);
  const size = Math.round((cleanBase64.length * 3) / 4);

  return {
    downloadUrl,
    storagePath,
    fileName,
    size,
    mimeType,
    storageType: 'gcs',
  };
}

/**
 * Deletes a file from Google Cloud Storage (GCS) given its storage path or full gs:// URL
 */
export async function deleteFileFromStorage(storagePathOrUrl: string): Promise<boolean> {
  if (!storagePathOrUrl) return false;
  try {
    const storage = getFirebaseStorage();
    let storagePath = storagePathOrUrl;

    // Handle full download URL or gs:// reference
    if (storagePathOrUrl.startsWith('gs://')) {
      const parts = storagePathOrUrl.replace(/^gs:\/\/[^/]+\//, '');
      storagePath = parts;
    } else if (storagePathOrUrl.includes('/o/')) {
      const match = storagePathOrUrl.match(/\/o\/([^?]+)/);
      if (match && match[1]) {
        storagePath = decodeURIComponent(match[1]);
      }
    }

    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
    return true;
  } catch (err: any) {
    // If already deleted (object-not-found), consider it a success
    if (err?.code === 'storage/object-not-found') {
      return true;
    }
    console.warn('[GCS Storage] Delete warning:', err);
    return false;
  }
}

/**
 * Obtains a permanent download URL for a file in Google Cloud Storage
 */
export async function getStorageDownloadUrl(storagePath: string): Promise<string> {
  const storage = getFirebaseStorage();
  const storageRef = ref(storage, storagePath);
  return await getDownloadURL(storageRef);
}

/**
 * Retrieves file metadata from Google Cloud Storage
 */
export async function getStorageFileMetadata(storagePath: string) {
  const storage = getFirebaseStorage();
  const storageRef = ref(storage, storagePath);
  return await getMetadata(storageRef);
}
