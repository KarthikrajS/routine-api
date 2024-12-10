import express from 'express';
import { registerUser, loginUser } from '../controllers/userController.js';
import { body, validationResult } from "express-validator"
import jwt from 'jsonwebtoken';
const router = express.Router();

// Register route
router.post('/register', [
    body("email").isEmail().withMessage("Please enter a valid email address."),
    body("password")
        .isLength({ min: 6 })
        .withMessage("Password must be at least 6 characters."),
], async (req, res) => {
    console.log("two");
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const { name, email, password } = req.body;
        const newUser = await registerUser(name, email, password);
        if (newUser?.status) {
            const payload = { userId: newUser._id };
            const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" });
            res.status(201).json({ token });
        } else {
            return res.status(400).json({ message: newUser?.message });
        }

    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Login route
router.post('/login', [
    body("email").isEmail().withMessage("Please enter a valid email address."),
    body("password").exists().withMessage("Password is required."),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const { email, password } = req.body;
        const response = await loginUser(email, password);
        if (response?.status) {
            return res.json({ token: response?.token });
        }
        return res.status(400).json({ message: response?.message });
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
});

export default router;
