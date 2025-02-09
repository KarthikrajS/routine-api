import mongoose from 'mongoose';
import { type } from 'os';
const DeviceSchema = new mongoose.Schema({
  deviceInfo: { type: String, required: true }, // User-Agent string
  ip: { type: String, required: true },        // IP address
  currentDevice: { type: Boolean, default: false }, // Is this the current device?
  lastLogin: { type: Date, default: Date.now },    // Last login time
  acceptLanguage: { type: String },
});

// const UserSchema = new mongoose.Schema({
//   name: { type: String, required: true },
//   email: { type: String, required: true, unique: true },
//   password: { type: String },
//   role: { type: String, enum: ['user', 'admin'], default: 'user' }, // Role-based access
//   mood: { type: String, default: "minimalist" },
//   picture: { type: String },
//   // metadata: {
//   //   device: { type: String }, // User agent string
//   //   ip: { type: String },     // User's IP address
//   //   locale: { type: String }, // If locale can be fetched separately
//   //   acceptLanguage: { type: String },
//   // },
//   devices: [DeviceSchema],
//   gender: { type: String },
//   is_verified: { type: Boolean },
//   age: { type: Number },
// }, { timestamps: true }); // Adds createdAt and updatedAt fields automatically

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  mood: { type: String, default: "minimalist" },
  picture: { type: String },
  devices: [DeviceSchema],
  gender: { type: String },
  is_verified: { type: Boolean },
  age: { type: Number },
  streak: { type: Number, default: 0 }, // Consecutive days
  lastCompletedDay: { type: Date },    // Last day with task completion
  progress: { type: Number, default: 0 }, // Daily progress in percentage
  rewards: {
    totalPoints: { type: Number, default: 0 }, // Total reward points earned
    badges: [{ type: String }], // Array of badge names earned
  }, 
}, { timestamps: true });

// const UserSchema = new mongoose.Schema({
//   name: { type: String, required: true },
//   email: { type: String, required: true, unique: true },
//   password: { type: String },
//   role: { type: String, enum: ['user', 'admin'], default: 'user' },
//   mood: { type: String, default: "minimalist" },
//   picture: { type: String },
//   devices: [DeviceSchema],
//   gender: { type: String },
//   is_verified: { type: Boolean },
//   age: { type: Number },
//   streak: {
//     count: { type: Number, default: 0 }, // Number of consecutive days with completed tasks
//     lastUpdated: { type: Date, default: null }, // Last day streak was updated
//   },
//   rewards: {
//     totalPoints: { type: Number, default: 0 }, // Total reward points earned
//     badges: [{ type: String }], // Array of badge names earned
//   },
// }, { timestamps: true });

const User = mongoose.model('User', UserSchema);
export default User;
