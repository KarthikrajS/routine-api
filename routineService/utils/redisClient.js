// utils/redisClient.js

import redis from 'redis';

const redisClient = redis.createClient({
    host: 'localhost', // Docker Redis container host
    port: 6379, // Default Redis port
});



redisClient.on('error', (err) => {
    console.error('Redis error:', err);
});

export default redisClient;
