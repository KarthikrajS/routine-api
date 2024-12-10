import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import amqp from 'amqplib';
import authRoutes from './routes/auth.js';
import { registerUser } from './controllers/userController.js';
import protectedRoute from './routes/protectedRoute.js';
import User from './models/User.js';
import { connectRabbitMQ } from './utils/rabbitmq.js';
import { fetchAndPublishUserList } from './utils/rabbitmq.js';
import cron from 'node-cron';
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

const getRabbitMQChannel = () => {
    if (!channel) throw new Error('RabbitMQ channel is not initialized');
    return channel;
};

// Register routes
app.use('/api/auth', authRoutes);

app.use('/api/protected', protectedRoute);

// Publish to RabbitMQ after user registration
app.post('/api/register', async (req, res) => {
    console.log(req?.body);
    const { name, email, password } = req.body;
    console.log("one");
    // Register user
    const user = await registerUser(name, email, password);

    console.log(user?.newUser, "user");
    // Publish to RabbitMQ
    await channel.sendToQueue('user_events', Buffer.from(JSON.stringify({ event: 'USER_REGISTERED', user: user?.newUser })));

    res.status(201).json({ message: 'User created', user });
});

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

cron.schedule('0 0 * * *', async () => {
    console.log('Running daily job to publish user list...');
    await fetchAndPublishUserList();
}, {
    timezone: 'UTC', // Adjust timezone as needed
});

// Start server
const PORT = process.env.PORT || 5000
// const queue = 'task_created';
app.listen(PORT, async () => {
    await connectRabbitMQ()
    
    
    // listenToEvents();
    console.log(`User Service running on PORT ${PORT}`);
});

