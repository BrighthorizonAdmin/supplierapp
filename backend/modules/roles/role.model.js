const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Role name is required'],
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: [50, 'Role name cannot exceed 50 characters'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [200, 'Description cannot exceed 200 characters'],
    },
    permissions: {
      type: [String],
      default: [],
    },
    isSystem: {
      type: Boolean,
      default: false, // system roles (super-admin, admin) cannot be deleted
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

roleSchema.index({ name: 1 }, { unique: true });
roleSchema.index({ isActive: 1 });

module.exports = mongoose.model('Role', roleSchema);
