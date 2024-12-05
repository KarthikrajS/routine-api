import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import amqp from 'amqplib';
import authRoutes from './routes/auth.js';
import { registerUser } from './controllers/userController.js';
import protectedRoute from './routes/protectedRoute.js';
import User from './models/User.js';
<<<<<<< Updated upstream
=======
import { connectRabbitMQ } from './utils/rabbitmq.js';
>>>>>>> Stashed changes

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json()); // Parse JSON request body

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => console.error('MongoDB connection error:', err));

// RabbitMQ setup
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
let channel, connection;

<<<<<<< Updated upstream
const connectRabbitMQ = async () => {
    try {
        connection = await amqp.connect(RABBITMQ_URL);
        channel = await connection.createChannel();
        await channel.assertQueue('user_events');
        return channel;
    } catch (err) {
        console.error('Failed to connect to RabbitMQ:', err);
        process.exit(1);
    }
};
=======
// const connectRabbitMQ = async () => {
//     try {
//         connection = await amqp.connect(RABBITMQ_URL);
//         channel = await connection.createChannel();
//         await channel.assertQueue('user_events');
//         return channel;
//     } catch (err) {
//         console.error('Failed to connect to RabbitMQ:', err);
//         process.exit(1);
//     }
// };
>>>>>>> Stashed changes

const getRabbitMQChannel = () => {
    if (!channel) throw new Error('RabbitMQ channel is not initialized');
    return channel;
};

// Register routes
app.use('/api/auth', authRoutes);

app.use('/api/protected', protectedRoute);

// Publish to RabbitMQ after user registration
app.post('/api/register', async (req, res) => {
    const { name, email, password } = req.body;

    // Register user
    const user = await registerUser(name, email, password);

    // Publish to RabbitMQ
    channel.sendToQueue('user_events', Buffer.from(JSON.stringify({ event: 'USER_REGISTERED', user })));

    res.status(201).json({ message: 'User created', user });
});

<<<<<<< Updated upstream
// Listen to RabbitMQ events (e.g., sending welcome email)
const listenToEvents = () => {
    channel.consume('user_events', (msg) => {
        const data = JSON.parse(msg.content.toString());
        if (data.event === 'USER_REGISTERED') {
            console.log('New user registered:', data.user);
            // Simulate sending a welcome notification
            sendWelcomeNotification(data.user);
        }
        channel.ack(msg);
    });
};

// Simulate sending a welcome notification (e.g., email)
const sendWelcomeNotification = (user) => {
    console.log(`Sending welcome notification to ${user?.newUser?.name} (${user?.newUser?.email})`);
};

// Start server
const PORT = process.env.PORT || 5000
const queue = 'task_created';
app.listen(PORT, async () => {
    await connectRabbitMQ().then(channel => {
        channel.assertQueue('taskQueue', { durable: true });

        // Example: Send a message when a user is created
        app.post('/users', async (req, res) => {
            try {
                const user = await User.create(req.body);
                channel.sendToQueue('taskQueue', Buffer.from(JSON.stringify({ type: 'USER_CREATED', data: user })));
                res.status(201).json(user);
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });
        //For task
        channel.assertQueue(queue, { durable: true });
        channel.consume(queue, (msg) => {
            const taskData = JSON.parse(msg.content.toString());
            // Process the task and update the user
            // (e.g., assigning task to a user or updating the user data)
        });
    });
    ;

    listenToEvents();
    console.log(`Server running on port ${PORT}`);
=======
// // Listen to RabbitMQ events (e.g., sending welcome email)
// const listenToEvents = () => {
//     channel.consume('user_events', (msg) => {
//         const data = JSON.parse(msg.content.toString());
//         if (data.event === 'USER_REGISTERED') {
//             console.log('New user registered:', data.user);
//             // Simulate sending a welcome notification
//             sendWelcomeNotification(data.user);
//         }
//         channel.ack(msg);
//     });
// };


// Start server
const PORT = process.env.PORT || 5000
// const queue = 'task_created';
app.listen(PORT, async () => {
    await connectRabbitMQ().then(channel => {
        // channel.assertQueue('taskQueue', { durable: true });

        // Example: Send a message when a user is created
        // app.post('/users', async (req, res) => {
        //     try {
        //         const user = await User.create(req.body);
        //         channel.sendToQueue('taskQueue', Buffer.from(JSON.stringify({ type: 'USER_CREATED', data: user })));
        //         res.status(201).json(user);
        //     } catch (err) {
        //         res.status(500).json({ error: err.message });
        //     }
        // });
        //For task
        // channel.assertQueue(queue, { durable: true });
        // channel.consume(queue, (msg) => {
        //     const taskData = JSON.parse(msg.content.toString());
        //     // Process the task and update the user
        //     // (e.g., assigning task to a user or updating the user data)
        // });
    });
    ;

    // listenToEvents();
    console.log(`User Service running on PORT ${PORT}`);
>>>>>>> Stashed changes
});
