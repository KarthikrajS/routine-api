import jwt from 'jsonwebtoken';
import redis from 'redis'
import redisClient from '../utils/redisClient.js';


const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'Authorization token missing' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Attach the decoded user to the request object
        next();
    } catch (error) {
        res.status(401).json({ message: 'Invalid or expired token' });
    }
};

 const cacheMiddleware = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    const userId = req.user.id;
    const { page, limit } = req.query;  // Use pagination and filters as cache key
    const cacheKey = `tasks:${userId}:${page}:${limit}`;

    try {
        // Check if the data exists in cache
        const cachedData = await redisClient.get(cacheKey);
        
        if (cachedData && userId) {
            console.log(cachedData,"cachedData");
            //  res.json(JSON.parse(cachedData));  // Send cached data if available
        }

        // If not cached, continue to the next middleware (database query)
        next();
    } catch (err) {
        console.error('Cache error: ', err);
        next();  // Proceed even if there is an error with cache
    }
};

export  { authMiddleware, cacheMiddleware};
