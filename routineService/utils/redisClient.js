// utils/redisClient.js

import redis from 'redis';

const url = process.env.REDIS_URL
const redisClient = redis.createClient({
    url
});



redisClient.on('error', (err) => {
    console.error('Redis error:', err);
});

export default redisClient;
