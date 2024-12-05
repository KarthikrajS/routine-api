
import express from 'express';
import proxy from 'express-http-proxy';
import dotenv from 'dotenv';
import cors from 'cors'

dotenv.config();
const app = express();

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:8001';
const TASK_SERVICE_URL = process.env.TASK_SERVICE_URL || 'http://localhost:8002';
<<<<<<< Updated upstream
app.use(cors()) 
// Proxy routes
app.use('/users', proxy(USER_SERVICE_URL));
app.use('/tasks', proxy(TASK_SERVICE_URL));
=======
const RL_SERVICE_URL = process.env.RL_SERVICE_URL || 'http://localhost:8003';
app.use(cors())
// Proxy routes
app.use('/users', proxy(USER_SERVICE_URL));
app.use('/tasks', proxy(TASK_SERVICE_URL));
app.use('/rl', proxy(RL_SERVICE_URL));
>>>>>>> Stashed changes

// Start the Gateway
const PORT = process.env.GATEWAY_PORT || 5000;
app.listen(PORT, () => console.log(`API Gateway running on port ${PORT}`));
