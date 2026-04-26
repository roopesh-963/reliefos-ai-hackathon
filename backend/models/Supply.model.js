const mongoose = require('mongoose');

const geoPointSchema = new mongoose.Schema(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  { _id: false }
);

const supplySchema = new mongoose.Schema(
  {
    shipmentId: {
      type: String,
      unique: true,
      required: true,
      trim: true,
    },
    trackingId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    resourceType: {
      type: String,
      enum: ['Medicine', 'Food', 'Water', 'Fuel', 'Equipment', 'Blankets', 'Ambulance'],
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unit: {
      type: String,
      default: 'units',
      trim: true,
    },
    from: {
      type: String,
      required: true,
      trim: true,
    },
    fromCoords: {
      type: geoPointSchema,
      required: true,
    },
    to: {
      type: String,
      required: true,
      trim: true,
    },
    toCoords: {
      type: geoPointSchema,
      required: true,
    },
    currentCoords: {
      type: geoPointSchema,
      default: null,
    },
    vehicle: {
      type: String,
      required: true,
      trim: true,
    },
    driver: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['Queued', 'In Transit', 'Delivered', 'Delayed', 'Rerouted'],
      default: 'Queued',
    },
    etaMinutes: {
      type: Number,
      required: true,
      min: 0,
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: 'Medium',
    },
    routeState: {
      type: String,
      enum: ['Clear', 'Watch', 'Blocked'],
      default: 'Clear',
    },
    blockedReason: {
      type: String,
      default: '',
      trim: true,
    },
    destinationType: {
      type: String,
      enum: ['Warehouse', 'Shelter', 'Camp', 'Clinic', 'Zone'],
      default: 'Zone',
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    sourceResourceIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'Resource',
      default: [],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

const toShipmentNumber = () => {
  const timePart = Date.now().toString().slice(-6);
  const randomPart = Math.floor(100 + Math.random() * 900);
  return `SC-${timePart}-${randomPart}`;
};

supplySchema.pre('validate', function supplyPreValidate(next) {
  if (!this.shipmentId) {
    this.shipmentId = toShipmentNumber();
  }
  if (!this.trackingId) {
    this.trackingId = this.shipmentId;
  }
  if (!this.currentCoords) {
    this.currentCoords = this.fromCoords;
  }
  next();
});

module.exports = mongoose.model('Supply', supplySchema);
