const multer = require('multer');
const path = require('path');
const { PassThrough } = require('stream');
const { v4: uuidv4 } = require('uuid');
const { MAX_FILE_SIZE, UPLOAD_PATH } = require('./env');

// Known magic byte signatures for each allowed MIME type
const MAGIC = {
  'image/jpeg':      { len: 3,  check: (b) => b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF },
  'image/png':       { len: 4,  check: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47 },
  'image/webp':      { len: 12, check: (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46
                                            && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 },
  'application/pdf': { len: 4,  check: (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 },
};

// Wraps a diskStorage instance to verify magic bytes before writing to disk.
// Valid files flow through unchanged. Spoofed files are rejected before hitting disk.
const magicStorage = (baseStorage) => ({
  _handleFile(req, file, cb) {
    const rule = MAGIC[file.mimetype];
    if (!rule) return cb(new Error('File type not allowed'));

    const pass = new PassThrough();
    const headerBuf = [];
    let headerSize = 0;
    let headerChecked = false;

    const reject = (msg) => {
      file.stream.removeListener('data', onData);
      file.stream.removeListener('end', onEnd);
      file.stream.resume(); // drain so the request doesn't hang
      pass.destroy(new Error(msg));
    };

    const onData = (chunk) => {
      if (headerChecked) { pass.write(chunk); return; }
      headerBuf.push(chunk);
      headerSize += chunk.length;
      if (headerSize >= rule.len) {
        headerChecked = true;
        const header = Buffer.concat(headerBuf);
        if (!rule.check(header)) { reject('File content does not match declared type'); return; }
        pass.write(header);
      }
    };

    const onEnd = () => {
      if (!headerChecked) {
        // File ended before enough bytes collected — verify what we have
        headerChecked = true;
        const header = Buffer.concat(headerBuf);
        if (!rule.check(header)) { reject('File content does not match declared type'); return; }
        pass.write(header);
      }
      pass.end();
    };

    file.stream.on('data', onData);
    file.stream.on('end', onEnd);
    file.stream.on('error', (err) => pass.destroy(err));

    baseStorage._handleFile(req, { ...file, stream: pass }, cb);
  },
  _removeFile: (req, file, cb) => baseStorage._removeFile(req, file, cb),
});

const createStorage = (subfolder) =>
  magicStorage(
    multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, path.join(UPLOAD_PATH, subfolder));
      },
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${uuidv4()}${ext}`);
      },
    })
  );

const documentFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPG, PNG and PDF files are allowed for documents'), false);
  }
};

const imageFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPG, PNG and WEBP images are allowed'), false);
  }
};

const uploadDocument = multer({
  storage: createStorage('documents'),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: documentFilter,
});

const uploadProductImage = multer({
  storage: createStorage('products'),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: imageFilter,
});

module.exports = { uploadDocument, uploadProductImage };
