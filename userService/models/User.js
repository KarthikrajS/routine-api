import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' }, // Role-based access
<<<<<<< Updated upstream
=======
  mood: { type: String, default: "minimalist" }
>>>>>>> Stashed changes
}, { timestamps: true }); // Adds createdAt and updatedAt fields automatically

const User = mongoose.model('User', UserSchema);
export default User;
