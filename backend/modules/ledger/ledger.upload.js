const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { MAX_FILE_SIZE, UPLOAD_PATH } = require('../../config/env');

/**
 * Ledger-module-local multer instance.
 * Deliberately NOT added to config/multer.js so the shared upload config stays
 * untouched. Proof screenshots land in uploads/ledger/ and are served by the
 * existing express.static('/uploads') route in server.js.
 */

const LEDGER_DIR = path.join(UPLOAD_PATH, 'ledger');

// Ensure the folder exists on first load (idempotent).
try {
  fs.mkdirSync(LEDGER_DIR, { recursive: true });
} catch (_) {
  /* directory already exists */
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, LEDGER_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const imageFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  cb(new Error('Only JPG, PNG, WEBP or PDF files are allowed for payment proof'), false);
};

const uploadLedgerProof = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: imageFilter,
});

// Public URL path for a stored file (matches server.js static mount).
const proofUrl = (filename) => `/uploads/ledger/${filename}`;

module.exports = { uploadLedgerProof, proofUrl, LEDGER_DIR };
