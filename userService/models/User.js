import mongoose from 'mongoose';
import { type } from 'os';
const DeviceSchema = new mongoose.Schema({
  deviceInfo: { type: String, required: true }, // User-Agent string
  ip: { type: String, required: true },        // IP address
  currentDevice: { type: Boolean, default: false }, // Is this the current device?
  lastLogin: { type: Date, default: Date.now },    // Last login time
  acceptLanguage: { type: String },
});

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  role: { type: String, enum: ['user', 'admin'], default: 'user' }, // Role-based access
  mood: { type: String, default: "minimalist" },
  picture: { type: String },
  // metadata: {
  //   device: { type: String }, // User agent string
  //   ip: { type: String },     // User's IP address
  //   locale: { type: String }, // If locale can be fetched separately
  //   acceptLanguage: { type: String },
  // },
  devices: [DeviceSchema],
  gender: { type: String },
  is_verified: { type: Boolean },
  age: { type: Number },
}, { timestamps: true }); // Adds createdAt and updatedAt fields automatically

const User = mongoose.model('User', UserSchema);
export default User;
