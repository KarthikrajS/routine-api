import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Register a new user
export const registerUser = async (name, email, password) => {
    const existingUser = await User.findOne({ email });
    if (existingUser) return { status: false, message: "User already exists" }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword });

    await newUser.save();
    return { status: true, newUser };
};

// Login user
export const loginUser = async (email, password) => {
    const user = await User.findOne({ email });
    if (!user) return { status: false, message: "Invalid credentials" }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) return { status: false, message: "Invalid credentials" }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    return { status: true, token };
};
