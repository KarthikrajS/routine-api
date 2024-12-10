import amqp from 'amqplib';
import User from '../models/User.js';

let channel, connection;

export const connectRabbitMQ = async () => {
    connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();

    // Listen to task events
    await channel.assertQueue('task_creation', { durable: true });
    await channel.assertQueue('task_updates', { durable: true });
    await channel.assertQueue('user_list_queue', { durable: true });


    channel.consume('task_creation', (msg) => {
        const task = JSON.parse(msg.content.toString());
        console.log('New Task Created:', task);
        channel.ack(msg);
        // Process or store the task as needed
    });

    channel.consume('user_events', (msg) => {
        const data = JSON.parse(msg.content.toString());
        if (data.event === 'USER_REGISTERED') {
            console.log('New user registered:', data.user);
            // Simulate sending a welcome notification
            sendWelcomeNotification(data.user);
        }
        channel.ack(msg);
    });

    channel.consume('task_updates', (msg) => {
        const task = JSON.parse(msg.content.toString());
        console.log('Task Updated:', task);
        channel.ack(msg);
        // Process or update user-specific data
    });

    console.log('RabbitMQ consumer connected.');
};
export const fetchAndPublishUserList = async () => {
    try {
        const users = await User.find(); // Fetch all users from the database

        if (users.length === 0) {
            console.log('No users found.');
            return;
        }

        console.log(`Found ${users.length} users. Publishing...`);
        for (const user of users) {
            await publishUserData({
                _id: user._id,
                username: user.username,
                email: user.email, // Include any relevant user fields
            });
        }
    } catch (error) {
        console.error('Error fetching and publishing user list:', error);
    }
};

export const publishUserData = async (user) => {
    try {
        await channel.sendToQueue('user_list_queue', Buffer.from(JSON.stringify(user)), {
            persistent: true,
        });
        console.log('Published user to user_list_queue:', user._id);
    } catch (error) {
        console.error('Error publishing user data:', error);
    }
};

export const closeRabbitMQ = async () => {
    await channel.close();
    await connection.close();
    console.log('RabbitMQ connection closed.');
};

// Simulate sending a welcome notification (e.g., email)
const sendWelcomeNotification = (user) => {
    console.log(`Sending welcome notification to ${user?.newUser?.name} (${user?.newUser?.email})`);
};
