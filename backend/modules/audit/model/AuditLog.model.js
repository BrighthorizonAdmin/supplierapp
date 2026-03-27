const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    entity: {
      type: String,
      enum: {
        values: ['dealer', 'order', 'payment', 'return', 'product', 'inventory', 'user', 'invoice', 'warehouse', 'retailOrder', 'marketingLead'],
        message: '{VALUE} is not a valid entity type',
      },
      required: [true, 'Entity type is required'],
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Entity ID is required'],
    },
    action: {
      type: String,
      enum: {
        values: ['create', 'update', 'delete', 'approve', 'reject', 'suspend', 'confirm', 'cancel', 'allocate', 'refund', 'login', 'logout', 'logCall', 'requestDocuments', 'advancePipeline', 'request_update'],
        message: '{VALUE} is not a valid action',
      },
      required: [true, 'Action is required'],
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      // required: [true, 'Performer is required'],
    },
    changes: {
      before: { type: mongoose.Schema.Types.Mixed },
      after: { type: mongoose.Schema.Types.Mixed },
    },
    ipAddress: { type: String },
    userAgent: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

// Append-only guards
auditLogSchema.pre('findOneAndUpdate', function () {
  throw new Error('Audit logs are immutable and cannot be modified');
});
auditLogSchema.pre('updateOne', function () {
  throw new Error('Audit logs are immutable and cannot be modified');
});
auditLogSchema.pre('deleteOne', function () {
  throw new Error('Audit logs are immutable and cannot be deleted');
});
auditLogSchema.pre('deleteMany', function () {
  throw new Error('Audit logs are immutable and cannot be deleted');
});

auditLogSchema.index({ entity: 1, entityId: 1 });
auditLogSchema.index({ performedBy: 1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ entity: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
