import express from 'express';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// A protected route that only authenticated users can access
router.get('/profile', protect, async (req, res) => {
    console.log("reached")
    res.json({ message: 'Welcome to your profile', user: req.user });
});
<<<<<<< Updated upstream

=======
router.put('/mood', protect, async (req, res) => {
    const { mood } = req.body;

    if (!mood) {
        return res.status(400).json({ error: "Mood is required" });
    }

    try {
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { mood },
            { new: true }
        );
        res.json({ success: true, mood: user.mood });
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
});
>>>>>>> Stashed changes
export default router;
