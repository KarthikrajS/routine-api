import amqp from 'amqplib';
import User from '../models/User.js';

let channel, connection;

export const connectRabbitMQ = async () => {
    connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();

    // Listen to task events
    await channel.assertQueue('task_creation', { durable: true });
    await channel.assertQueue('task_service_reply_queue', { durable: true })
    await channel.assertQueue('task_updates', { durable: true });
    await channel.assertQueue('user_list_queue', { durable: true });
    await channel.assertQueue('user_events', { durable: true });


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

    // channel.consume('task_updates', (msg) => {
    //     const task = JSON.parse(msg.content.toString());
    //     console.log('Task Updated:', task);
    //     channel.ack(msg);
    //     // Process or update user-specific data
    // });

    channel.consume('task_updates', async (msg) => {
        console.log(msg.content.toString(), "msg.content.toString()");
        const { _id, userId, status, dueDate } = JSON.parse(msg.content.toString());
        console.log('Task Updated:', { _id, userId, status, dueDate });

        if (status === "completed") {
            await updateUserStreakAndProgress(userId, dueDate);
        }

        channel.ack(msg);
    });

    console.log('RabbitMQ consumer connected.');
};

// const updateUserStreakAndProgress = async (userId, taskDueDate) => {
//     try {
//         const user = await User.findById(userId);
//         if (!user) {
//             console.error(`User not found for ID: ${userId}`);
//             return;
//         }

//         const today = new Date().setHours(0, 0, 0, 0);
//         const taskDate = new Date(taskDueDate.startDate).setHours(0, 0, 0, 0);

//         if (taskDate !== today) {
//             console.log('Task not due today, skipping streak update.');
//             return;
//         }

//         // Update streak
//         if (user.lastCompletedDay) {
//             const lastDay = new Date(user.lastCompletedDay).setHours(0, 0, 0, 0);
//             if (today - lastDay === 86400000) { // 1 day difference
//                 user.streak += 1;
//             } else if (today - lastDay > 86400000) {
//                 user.streak = 1; // Reset streak
//             }
//         } else {
//             user.streak = 1; // First completed day
//         }
//         user.lastCompletedDay = today;

//         // Calculate daily progress
//         const completedTasks = await Task.countDocuments({ userId, status: "completed", "dueDate.startDate": { $lte: today }, "dueDate.endDate": { $gte: today } });
//         const totalTasks = await Task.countDocuments({ userId, "dueDate.startDate": { $lte: today }, "dueDate.endDate": { $gte: today } });

//         user.progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

//         await user.save();
//         console.log(`Updated streak and progress for user ${userId}`);
//     } catch (error) {
//         console.error('Error updating user streak and progress:', error.message);
//     }
// };

const updateUserStreakAndProgress = async (userId, taskDueDate) => {
    try {
        const user = await User.findById(userId);
        if (!user) {
            console.error(`User not found for ID: ${userId}`);
            return;
        }

        const today = new Date().setHours(0, 0, 0, 0);
        const taskDate = new Date(taskDueDate.startDate).setHours(0, 0, 0, 0);

        if (taskDate !== today) {
            console.log('Task not due today, skipping streak update.');
            return;
        }

        // Prepare request for task data
        const taskQueryMessage = {
            userId,
            date: today,
        };


        // Send message to Task Service via RabbitMQ
        const taskData = await sendMessageAndWaitForResponse('task_data_request', taskQueryMessage);

        if (!taskData) {
            console.error(`Failed to fetch task data for user ID: ${userId}`);
            return;
        }

        const { completedTasks, totalTasks } = taskData;

        console.log(completedTasks, totalTasks, "completedTasks, totalTasks");
        // Update streak
        if (user.lastCompletedDay) {
            const lastDay = new Date(user.lastCompletedDay).setHours(0, 0, 0, 0);
            if (today - lastDay === 86400000) { // 1 day difference
                user.streak += 1;
            } else if (today - lastDay > 86400000) {
                user.streak = 1; // Reset streak
            }
        } else {
            user.streak = 1; // First completed day
        }
        user.lastCompletedDay = today;

        // Calculate daily progress
        user.progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

        await user.save();
        console.log(`Updated streak and progress for user ${userId}`);
    } catch (error) {
        console.error('Error updating user streak and progress:', error.message);
    }
};

export const sendMessageAndWaitForResponse = async (queue, message) => {
    try {
        const correlationId = generateCorrelationId();
        const replyQueue = 'task_service_reply_queue';
        const { userId } = message;

        // Ensure reply queue exists
        // await channel.assertQueue(replyQueue, { durable: false });

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Response timeout.'));
            }, 100000); // 10-second timeout

            console.log(queue, "queue");
            message.replyTo = replyQueue
            message.correlationId = correlationId;
            message.useId = userId
            console.log("Sending message:", { queue, message, correlationId });
            channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
                correlationId,
                replyTo: replyQueue,
            });
            // channel.sendToQueue(queue, Buffer.from(messageContent), {
            //     correlationId: correlationId,
            //     replyTo: replyQueue,
            // });

            // When consuming the message
            channel.consume(replyQueue, (msg) => {
                console.log("Received message:", msg);
                console.log("Expected correlationId:", correlationId);
                console.log("Message correlationId:", msg.properties.correlationId);

                if (msg.properties.correlationId === correlationId) {
                    clearTimeout(timeout);
                    try {
                        const content = JSON.parse(msg.content.toString());
                        console.log("Parsed content:", content);
                        resolve(content);
                    } catch (error) {
                        console.error("Error parsing message content:", error);
                        reject(error);
                    }
                    channel.ack(msg);
                }
            }, { noAck: false });


        });
    } catch (error) {
        console.error('Error in sendMessageAndWaitForResponse:', error);
        throw error;
    }
};


const generateCorrelationId = () => {
    return `${Math.random().toString(36).substr(2, 9)}-${Date.now()}`;
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
