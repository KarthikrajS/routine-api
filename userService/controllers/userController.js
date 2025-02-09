import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client('951190317533-5i7qnra1drubaoi59559oss8eht8b7u7.apps.googleusercontent.com');
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

export const getUserStats = async (req, res) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId, "streak progress");
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        res.status(200).json({ streak: user.streak, progress: user.progress });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getUserRewards = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({
            rewards: user.rewards,
            streak: user.streak,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};


export const googleLogin = async (req, res) => {
    try {
        console.log(req.body, "req.body: google");
        const { token, email, name, picture, locale, gender, age, is_verified } = req.body;

        // Verify the Google ID token
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: '951190317533-5i7qnra1drubaoi59559oss8eht8b7u7.apps.googleusercontent.com',
        });
        const payload = ticket.getPayload();
        console.log('Google Payload:', payload);
        const userAgent = req.headers['user-agent'];
        // Extract device metadata from headers
        const deviceInfo = req.headers['user-agent'];
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const acceptLanguage = req.headers['accept-language'];

        // Find or create the user in the database
        let user = await User.findOne({ email });
        if (!user) {
            user = new User({
                email,
                name,
                picture,
                locale,
                is_verified,
                devices: [
                    {
                        deviceInfo,
                        ip,
                        currentDevice: true,
                        lastLogin: new Date(),
                    },
                ],
                gender, // May require more logic to fetch
                age,    // May require more logic to fetch
            });

        } else {
            // Update the devices array
            const deviceIndex = user.devices.findIndex(
                (device) => device.deviceInfo === deviceInfo && device.ip === ip
            );

            if (deviceIndex === -1) {
                // Add new device if not found
                user.devices.push({
                    deviceInfo,
                    ip,
                    currentDevice: true,
                    lastLogin: new Date(),
                });
            } else {
                // Update existing device
                user.devices[deviceIndex].currentDevice = true;
                user.devices[deviceIndex].lastLogin = new Date();
            }

            // Mark all other devices as not current
            user.devices = user.devices.map((device, index) => {
                if (index !== deviceIndex) {
                    device.currentDevice = false;
                }
                return device;
            });
        }
        /*
        // Limit the number of devices to 5
            if (user.devices.length > 5) {
                user.devices.sort((a, b) => new Date(a.lastLogin) - new Date(b.lastLogin));
                user.devices.shift(); // Remove the oldest device
            }
        */
        await user.save();

        // Generate a session or token (JWT)
        const jwtToken = generateJwt(user);

        res.status(200).json({ message: 'Login successful', token: jwtToken });
    } catch (err) {
        console.error(err);
        res.status(400).json({ message: 'Google login failed' });
    }
};

// Helper function to generate JWT
const generateJwt = (user) => {
    const payload = { id: user._id, email: user.email };
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
};
