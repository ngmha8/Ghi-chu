import path from 'path';
import fs from 'fs';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { getFirestoreDb, getDbDriveServiceAccountConfig } from './firebaseDb.ts';
import {
  uploadFileToDriveFolder,
  deleteFileFromDrive,
  downloadFileFromDrive,
} from './googleDriveServiceAccount.ts';
import type { DriveFile } from '../src/types/index.ts';

const _dirname = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
export const UPLOADS_DIR = path.join(_dirname, 'data', 'uploads');

// Ensure uploads cache directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  try {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  } catch (e) {
    console.warn('Could not create uploads directory:', e);
  }
}

// 500 KB binary chunk size (well within Firestore 1 MB document limit)
const CHUNK_SIZE = 500 * 1024;

export interface PersistentBinaryResult {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  source: 'cache' | 'drive' | 'vault';
}

export interface SavePersistentResult {
  storageType: 'drive' | 'firestore_vault' | 'disk';
  driveFileId?: string;
  webViewLink?: string;
  isSyncedToDrive: boolean;
  savedToVault: boolean;
}

/**
 * Strips huge base64/binary payloads before saving metadata to Firestore
 * to prevent 1MB document limit breaches and minimize bandwidth.
 */
export function sanitizeFileMetadataForFirestore(file: DriveFile): DriveFile {
  const clean: DriveFile = { ...file };
  delete clean.base64Data;
  if (clean.thumbnailUrl && clean.thumbnailUrl.length > 40000) {
    delete clean.thumbnailUrl;
  }
  return clean;
}

/**
 * Saves binary permanently across Cloud Run container instances:
 * 1. Writes to ephemeral L1 disk cache for fast local access
 * 2. Writes to persistent Firestore Binary Vault (chunked if needed)
 * 3. Automatically syncs to Google Drive if Service Account is configured
 */
export async function savePersistentBinary(params: {
  fileId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  tryDriveSync?: boolean;
}): Promise<SavePersistentResult> {
  const { fileId, fileName, mimeType, buffer, tryDriveSync = true } = params;

  // 1. Write to local ephemeral disk cache (L1 cache)
  try {
    const safeName = path.basename(fileName);
    const diskPath = path.join(UPLOADS_DIR, `${fileId}_${safeName}`);
    fs.writeFileSync(diskPath, buffer);
    const binPath = path.join(UPLOADS_DIR, `${fileId}.bin`);
    fs.writeFileSync(binPath, buffer);
  } catch (err) {
    console.warn(`[Storage] Ephemeral cache write warning for ${fileId}:`, err);
  }

  let savedToVault = false;

  // 2. Persist to Firestore Binary Vault (Cloud L2 Storage)
  const db = getFirestoreDb();
  if (db) {
    try {
      const totalBytes = buffer.length;
      if (totalBytes <= CHUNK_SIZE) {
        // Single document for files <= 500KB
        await setDoc(doc(db, 'file_binaries', fileId), {
          fileId,
          fileName,
          mimeType,
          size: totalBytes,
          totalChunks: 1,
          data: buffer.toString('base64'),
          updatedAt: new Date().toISOString(),
        });
        savedToVault = true;
      } else {
        // Multi-chunk storage for larger files
        const totalChunks = Math.ceil(totalBytes / CHUNK_SIZE);
        await setDoc(doc(db, 'file_binaries', fileId), {
          fileId,
          fileName,
          mimeType,
          size: totalBytes,
          totalChunks,
          chunkSize: CHUNK_SIZE,
          updatedAt: new Date().toISOString(),
        });

        const chunkPromises: Promise<any>[] = [];
        for (let i = 0; i < totalChunks; i++) {
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, totalBytes);
          const chunkBuffer = buffer.subarray(start, end);
          const chunkDocId = `${fileId}_chunk_${i}`;
          chunkPromises.push(
            setDoc(doc(db, 'file_binaries', chunkDocId), {
              fileId,
              chunkIndex: i,
              data: chunkBuffer.toString('base64'),
              updatedAt: new Date().toISOString(),
            })
          );
        }
        await Promise.all(chunkPromises);
        savedToVault = true;
      }
      console.log(`☁️ [Storage Vault] File ${fileId} (${(buffer.length / 1024).toFixed(1)} KB) persisted to Firestore.`);
    } catch (vaultErr) {
      console.warn(`[Storage Vault] Firestore write warning for ${fileId}:`, vaultErr);
    }
  }

  // 3. Optional Drive Sync via Google Service Account (if configured)
  let isSyncedToDrive = false;
  let driveFileId: string | undefined;
  let webViewLink: string | undefined;

  if (tryDriveSync) {
    try {
      const saConfig = await getDbDriveServiceAccountConfig();
      if (saConfig.isEnabled && saConfig.isConnected && saConfig.folderId) {
        const driveResult = await uploadFileToDriveFolder(
          saConfig,
          fileName,
          mimeType,
          buffer
        );
        if (driveResult?.uploadedToDrive && driveResult.id) {
          isSyncedToDrive = true;
          driveFileId = driveResult.id;
          webViewLink = driveResult.webViewLink;
          console.log(`📁 [Drive Sync] File ${fileName} synced to Google Drive: ${driveFileId}`);
        }
      }
    } catch (driveErr) {
      console.info(`ℹ️ [Drive Sync] Deferred for ${fileName}:`, driveErr);
    }
  }

  return {
    storageType: isSyncedToDrive ? 'drive' : (savedToVault ? 'firestore_vault' : 'disk'),
    driveFileId,
    webViewLink,
    isSyncedToDrive,
    savedToVault,
  };
}

/**
 * Retrieves a file binary using Multi-Tier Read-Through Architecture:
 * 1. Checks local disk cache (L1 cache hit)
 * 2. If missing on disk (Cloud Run container restarted), fetches from Google Drive
 * 3. If not on Drive, reassembles from Firestore Binary Vault (L2 hit)
 * 4. Automatically re-hydrates disk cache for subsequent requests
 */
export async function getPersistentBinary(
  fileId: string,
  driveFileId?: string,
  fallbackName = 'document',
  fallbackMime = 'application/octet-stream'
): Promise<PersistentBinaryResult | null> {
  // --- TIER 1: Ephemeral Local Disk Cache ---
  try {
    if (fs.existsSync(UPLOADS_DIR)) {
      const filesInDir = fs.readdirSync(UPLOADS_DIR);
      const matched = filesInDir.find(fn => fn.startsWith(fileId));
      if (matched) {
        const fullPath = path.join(UPLOADS_DIR, matched);
        if (fs.existsSync(fullPath)) {
          const buffer = fs.readFileSync(fullPath);
          return {
            buffer,
            mimeType: fallbackMime,
            fileName: fallbackName,
            source: 'cache',
          };
        }
      }
    }
  } catch (diskErr) {
    console.warn(`[Storage] Cache read error for ${fileId}:`, diskErr);
  }

  // --- TIER 2: Google Drive Download ---
  if (driveFileId) {
    try {
      const saConfig = await getDbDriveServiceAccountConfig();
      if (saConfig.clientEmail && saConfig.privateKey) {
        const driveData = await downloadFileFromDrive(saConfig, driveFileId);
        if (driveData?.buffer) {
          // Re-hydrate local disk cache
          try {
            const safeName = path.basename(driveData.fileName || fallbackName);
            fs.writeFileSync(path.join(UPLOADS_DIR, `${fileId}_${safeName}`), driveData.buffer);
          } catch (e) {}

          return {
            buffer: driveData.buffer,
            mimeType: driveData.mimeType || fallbackMime,
            fileName: driveData.fileName || fallbackName,
            source: 'drive',
          };
        }
      }
    } catch (driveErr) {
      console.warn(`[Storage] Drive fetch fallback for ${driveFileId}:`, driveErr);
    }
  }

  // --- TIER 3: Firestore Binary Vault (Read-Through Cache Recovery) ---
  const db = getFirestoreDb();
  if (db) {
    try {
      const mainSnap = await getDoc(doc(db, 'file_binaries', fileId));
      if (mainSnap.exists()) {
        const mainData = mainSnap.data();
        const totalChunks = mainData.totalChunks || 1;
        const resolvedName = mainData.fileName || fallbackName;
        const resolvedMime = mainData.mimeType || fallbackMime;

        let finalBuffer: Buffer | null = null;

        if (totalChunks === 1 && mainData.data) {
          finalBuffer = Buffer.from(mainData.data, 'base64');
        } else if (totalChunks > 1) {
          const chunkSnaps = await Promise.all(
            Array.from({ length: totalChunks }, (_, idx) =>
              getDoc(doc(db, 'file_binaries', `${fileId}_chunk_${idx}`))
            )
          );
          const chunkBuffers: Buffer[] = [];
          for (let i = 0; i < totalChunks; i++) {
            const cData = chunkSnaps[i]?.data();
            if (cData?.data) {
              chunkBuffers.push(Buffer.from(cData.data, 'base64'));
            }
          }
          if (chunkBuffers.length === totalChunks) {
            finalBuffer = Buffer.concat(chunkBuffers);
          }
        }

        if (finalBuffer) {
          // Cache hydration: re-write file to ephemeral disk so subsequent reads are instant
          try {
            const safeName = path.basename(resolvedName);
            fs.writeFileSync(path.join(UPLOADS_DIR, `${fileId}_${safeName}`), finalBuffer);
            fs.writeFileSync(path.join(UPLOADS_DIR, `${fileId}.bin`), finalBuffer);
          } catch (e) {}

          console.log(`⚡ [Storage] Recovered ${resolvedName} (${(finalBuffer.length / 1024).toFixed(1)} KB) from Firestore Vault.`);
          return {
            buffer: finalBuffer,
            mimeType: resolvedMime,
            fileName: resolvedName,
            source: 'vault',
          };
        }
      }
    } catch (vaultErr) {
      console.warn(`[Storage] Vault retrieval error for ${fileId}:`, vaultErr);
    }
  }

  return null;
}

/**
 * Ensures the file exists on the local disk (hydrates from Drive or Firestore Vault if needed).
 * Returns the absolute path on disk, or null if unrecoverable.
 */
export async function ensureLocalCacheFile(
  fileId: string,
  driveFileId?: string,
  fallbackName = 'document'
): Promise<string | null> {
  const binary = await getPersistentBinary(fileId, driveFileId, fallbackName);
  if (!binary) return null;

  try {
    const safeName = path.basename(binary.fileName || fallbackName);
    const targetPath = path.join(UPLOADS_DIR, `${fileId}_${safeName}`);
    if (!fs.existsSync(targetPath)) {
      fs.writeFileSync(targetPath, binary.buffer);
    }
    return targetPath;
  } catch (e) {
    return null;
  }
}

/**
 * Permanently deletes binary data across all tiers (Drive, Firestore Vault, Local Disk)
 */
export async function deletePersistentBinary(
  fileId: string,
  driveFileId?: string
): Promise<boolean> {
  // 1. Delete from Drive
  if (driveFileId) {
    try {
      const saConfig = await getDbDriveServiceAccountConfig();
      if (saConfig.isEnabled && saConfig.isConnected) {
        await deleteFileFromDrive(saConfig, driveFileId);
      }
    } catch (e) {
      console.warn('[Storage] Drive file deletion notice:', e);
    }
  }

  // 2. Delete from Firestore Binary Vault
  const db = getFirestoreDb();
  if (db) {
    try {
      const mainSnap = await getDoc(doc(db, 'file_binaries', fileId));
      if (mainSnap.exists()) {
        const totalChunks = mainSnap.data().totalChunks || 1;
        const deleteOps: Promise<any>[] = [deleteDoc(doc(db, 'file_binaries', fileId))];
        if (totalChunks > 1) {
          for (let i = 0; i < totalChunks; i++) {
            deleteOps.push(deleteDoc(doc(db, 'file_binaries', `${fileId}_chunk_${i}`)));
          }
        }
        await Promise.all(deleteOps);
      }
    } catch (vaultErr) {
      console.warn(`[Storage] Vault deletion notice for ${fileId}:`, vaultErr);
    }
  }

  // 3. Delete from Local Ephemeral Disk Cache
  try {
    if (fs.existsSync(UPLOADS_DIR)) {
      const filesInDir = fs.readdirSync(UPLOADS_DIR);
      const matched = filesInDir.filter(fn => fn.startsWith(fileId));
      for (const fn of matched) {
        try {
          fs.unlinkSync(path.join(UPLOADS_DIR, fn));
        } catch (e) {}
      }
    }
  } catch (diskErr) {
    console.warn(`[Storage] Disk purge error for ${fileId}:`, diskErr);
  }

  return true;
}
