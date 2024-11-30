import dotenv from "dotenv"
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import connectToDB from './utils/db.js';
import taskRoutes from './routes/taskRoutes.js';
import { connectRabbitMQ } from "./utils/rabbitmq.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

// Routes
app.use('/tasks', taskRoutes);

const queue = 'task_created';
connectRabbitMQ().then(channel => {

    //For user creation
    channel.assertQueue('taskQueue', { durable: true });


    // Consume messages from the queue
    channel.consume('taskQueue', async (msg) => {
        if (msg !== null) {
            const message = JSON.parse(msg.content.toString());
            if (message.type === 'USER_CREATED') {
                console.log('New user created:', message.data);
                // Optionally: Add logic to link tasks with the new user
            }
            channel.ack(msg);
        }
    });

    //For task produce
    channel.assertQueue(queue, { durable: true });
    channel.sendToQueue(queue, Buffer.from(JSON.stringify("taskData")), {
        persistent: true,
    });
});


// Start server
connectToDB().then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch(err => console.error('Database connection failed:', err));
