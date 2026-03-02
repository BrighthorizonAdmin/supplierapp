const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    dealerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Dealer',
      required: [true, 'Dealer ID is required'],
    },
    documentType: {
      type: String,
      enum: {
        values: ['gst-certificate', 'pan-card', 'address-proof', 'bank-statement', 'cancelled-cheque', 'trade-license', 'other'],
        message: '{VALUE} is not a valid document type',
      },
      required: [true, 'Document type is required'],
    },
    fileName: {
      type: String,
      required: [true, 'File name is required'],
    },
    originalName: {
      type: String,
    },
    filePath: {
      type: String,
      required: [true, 'File path is required'],
    },
    fileSize: {
      type: Number,
    },
    mimeType: {
      type: String,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Uploader is required'],
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    verifiedAt: {
      type: Date,
    },
    remarks: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

documentSchema.index({ dealerId: 1 });
documentSchema.index({ documentType: 1 });
documentSchema.index({ dealerId: 1, documentType: 1 });

module.exports = mongoose.model('Document', documentSchema);
