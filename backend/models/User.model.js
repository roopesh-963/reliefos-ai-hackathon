/**
 * models/User.model.js
 * --------------------
 * Represents a registered user.
 * Matches the Login/Register UI in your frontend.
 *
 * Roles:
 *   - citizen      → Can submit SOS, view map
 *   - rescue_team  → Can view SOS, update status
 *   - admin        → Full access: manage resources, alerts, analytics
 *
 * The password is hashed with bcrypt BEFORE saving (pre-save hook below).
 * We also add a helper method `matchPassword` for login comparison.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
    },
    role: {
      type: String,
      enum: ['citizen', 'rescue_team', 'admin'],
      default: 'citizen',
    },
    // Optional: profile picture, location, team assignment
    avatar: { type: String, default: '' },
    teamId: { type: String, default: null }, // For rescue_team members
  },
  { timestamps: true } // Adds createdAt, updatedAt automatically
);

// ── Hash password before saving ──────────────────────────────────────────────
// This hook runs before every .save() call.
// 'this' refers to the document being saved.
// We only re-hash if the password field was actually changed.
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ── Instance method: compare entered password with stored hash ────────────────
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
