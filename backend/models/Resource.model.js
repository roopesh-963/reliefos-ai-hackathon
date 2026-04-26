const mongoose = require('mongoose');

const allocationSchema = new mongoose.Schema(
  {
    target: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    allocatedAt: {
      type: Date,
      default: Date.now,
    },
    allocatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { _id: false }
);

const resourceSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['Medicine', 'Food', 'Water', 'Fuel', 'Equipment', 'Ambulance'],
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Resource name is required'],
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    unit: {
      // e.g. "units", "packs", "cans", "liters"
      type: String,
      default: 'units',
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: 'Medium',
    },
    status: {
      type: String,
      enum: ['Healthy', 'Low', 'Critical'],
      default: 'Healthy',
    },
    location: {
      type: String,
      required: true,
      default: 'Warehouse 01',
    },
    lastChecked: {
      type: Date,
      default: Date.now,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    isDeployed: {
      type: Boolean,
      default: false,
    },
    deploymentTarget: {
      // e.g. "Shelter A", "Mobile Clinic 4"
      type: String,
      default: null,
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    allocations: {
      type: [allocationSchema],
      default: [],
    },
  },
  { timestamps: true }
);

resourceSchema.pre('save', function resourcePreSave(next) {
  this.lastUpdated = new Date();
  this.lastChecked = new Date();
  next();
});

module.exports = mongoose.model('Resource', resourceSchema);
