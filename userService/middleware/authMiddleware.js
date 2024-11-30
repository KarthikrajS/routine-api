import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// export const protect = (req, res, next) => {
//     console.log(req.headers);
//     const token = req.headers.authorization?.split(' ')[1];

//     console.log(token, "token1");
//     if (!token) {
//         return res.status(401).json({ message: 'No token, authorization denied' });
//     }

//     try {
//         const decoded = jwt.verify(token, process.env.JWT_SECRET);
//         req.user = decoded; // Add user info to request object
//         next(); // Proceed to the next middleware or route handler
//     } catch (error) {
//         res.status(401).json({ message: 'Token is not valid' });
//     }
// };
export const protect = async (req, res, next) => {
    console.log("Headers:", req.headers); // Debug headers
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
        return res.status(401).json({ message: "No token, authorization denied" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log(decoded, "decoded");
        const user = await User.findById(decoded?.id)
        console.log("user", user);
        req.user = user; // Attach user data to the request object
        next();
    } catch (error) {
        console.error("JWT Error:", error.message); // Log JWT errors
        res.status(401).json({ message: "Token is not valid" });
    }
};