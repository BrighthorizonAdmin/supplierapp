const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { MAX_FILE_SIZE, UPLOAD_PATH } = require('./env');

const createStorage = (subfolder) =>
  multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, path.join(UPLOAD_PATH, subfolder));
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${uuidv4()}${ext}`);
    },
  });

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
