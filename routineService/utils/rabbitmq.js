import amqp from 'amqplib';

let channel, connection;

const connectRabbitMQ = async () => {
    try {
        connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
        channel = await connection.createChannel();

        //For RL serice
        await channel.assertQueue('taskQueue', { durable: true });

        await channel.assertQueue('task_creation', { durable: true });
        await channel.assertQueue('task_updates', { durable: true });
        await channel.assertQueue('analysisQueue', { durable: true });
        await channel.assertQueue('task_list', { durable: true });
        await channel.assertQueue('task_suggestion_queue', { durable: true });

        console.log('Connected to RabbitMQ');
        return channel;
    } catch (err) {
        console.error('Failed to connect to RabbitMQ:', err);
        process.exit(1);
    }
};

export const sendMessage = async (queue, message) => {
    try {
        await channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), { persistent: true });
        console.log(`Message sent to ${queue}:`, message);
    } catch (error) {
        console.error('Error sending message:', error);
    }
};

// Helper function to acknowledge the message safely
const acknowledgeMessage = async (message) => {
    if (message?.fields?.deliveryTag) {
        try {
            await channel.ack(message);
        } catch (ackError) {
            console.error('Error acknowledging message:', ackError);
        }
    } else {
        console.error('Missing deliveryTag, message will not be acknowledged:', message);
    }
};

// Helper function to parse message content
// Helper function to parse message content and log raw buffer
// const parseMessageContent = (message) => {
//     try {
//         // Check if content is a string or an object
//         const contentString = typeof message.content === 'string'
//             ? message.content
//             : JSON.stringify(message.content);

//         const parsedContent = JSON.parse(contentString);

//         console.log('Decoded message content:', parsedContent);

//         // Validate the message structure
//         if (!Array.isArray(parsedContent) || parsedContent.length !== 2) {
//             throw new Error('Message content must be an array of [userId, suggestions]');
//         }

//         const [userId, suggestions] = parsedContent;

//         if (typeof userId !== 'string' || !Array.isArray(suggestions)) {
//             throw new Error('Invalid message content format: userId must be a string and suggestions an array');
//         }

//         return parsedContent;
//     } catch (error) {
//         console.error('Error parsing message content:', error);
//         return null; // Signal malformed message
//     }
// };
const parseMessageContent = (messageContent) => {
    try {
        console.log(messageContent, "messageContent")
        if (!messageContent) {
            throw new Error("Invalid message content: 'data' is undefined");
        }

        // Convert Buffer data to a string
        const decodedMessage = Buffer.from(messageContent).toString();

        console.log(decodedMessage, "decodedMessage");
        // Parse the string as JSON
        const parsedMessage = decodedMessage;
        console.log(parsedMessage, "parsedMessage");

        // Validate the structure
        if (Array.isArray(messageContent) && messageContent.length === 2) {
            const [userId, suggestions] = messageContent;

            // Ensure `suggestions` is an array
            if (typeof userId === 'string' && Array.isArray(suggestions)) {
                return { userId, suggestions };
            } else {
                throw new Error("Invalid structure in parsed message");
            }
        } else {
            throw new Error("Message content must be an array of [userId, suggestions]");
        }
    } catch (err) {
        console.error("Error parsing message content:", err);
        throw err; // Re-throw the error for upstream handling
    }
};



export const consumeMessage = async (queue, callback) => {
    await channel.consume(queue, async (message) => {
        try {

            console.log('Received message:', message);
            const rawContent = message.content.toString();
            const messageContent = JSON.parse(rawContent);
            // const messageContent = JSON.parse(message.content.toString());
            const parsedMessage = parseMessageContent(messageContent);
            if (!parsedMessage) return acknowledgeMessage(message); // Skip if parsing fails

            // Call the provided callback with the parsed message
            await callback(parsedMessage);

            await acknowledgeMessage(message); // Acknowledge after processing
        } catch (error) {
            console.error('Error processing message:', error);
            await acknowledgeMessage(message); // Acknowledge to prevent it from being stuck in the queue
        }
    }, { noAck: false });
};


// export const consumeMessage = async (queue) => {
//     // consumeSuggestions
//     await channel.consume(queue, (message) => {
//         const suggestions = JSON.parse(message.content.toString());
//         console.log('Received suggestions from RL service:', suggestions);

//         // Update database or notify front-end with suggestions
//         channel.ack(message);
//     });
// }

export const closeRabbitMQ = async () => {
    await channel.close();
    await connection.close();
    console.log('RabbitMQ connection closed.');
};

const getRabbitMQChannel = () => {
    if (!channel) throw new Error('RabbitMQ channel is not initialized');
    return channel;
};

// import { getTasksForUser } from './taskService'; // Import user-specific task fetcher
// import { sendMessage, consumeMessage } from './rabbitmq'; // RabbitMQ helpers
import { getAllTasks } from '../controllers/taskController.js';
import Task from '../models/taskModel.js';

// Function to fetch the user list from RabbitMQ
// export const fetchUserList = async () => {
//     const channel = getRabbitMQChannel();
//     const userList = [];

//     try {
//         await channel.consume('user_list_queue', (message) => {
//             const user = JSON.parse(message.content.toString());
//             console.log('Received user:', user);
//             userList.push(user);

//             // Acknowledge the message after processing
//             channel.ack(message);
//         }, { noAck: false });

//         return new Promise((resolve) => {
//             // Wait for all messages to be consumed before resolving
//             setTimeout(() => resolve(userList), 5000); // 5-second buffer
//         });
//     } catch (error) {
//         console.error('Error fetching user list:', error);
//         throw error;
//     }
// };

//simplifying
export const fetchUserList = async () => {
    const channel = getRabbitMQChannel();
    const userList = [];

    try {
        while (true) {
            const message = await channel.get('user_list_queue', { noAck: false });
            if (!message) break; // Exit loop when the queue is empty

            const user = JSON.parse(message.content.toString());
            console.log('Received user:', user);
            userList.push(user);
            channel.ack(message); // Acknowledge message
        }

        return userList;
    } catch (error) {
        console.error('Error fetching user list:', error);
        throw error;
    }
};


// Function to publish task list for all users
// export const publishTaskListForAllUsers = async () => {
//     try {
//         console.log('Fetching user list...');
//         const users = await fetchUserList();

//         console.log(`Found ${users.length} users. Fetching tasks for each user...`);
//         for (const user of users) {
//             const taskList = await getAllTasks(user._id); // Fetch tasks for user

//             if (taskList.length > 0) {
//                 await sendMessage('task_list', {
//                     userId: user._id,
//                     tasks: taskList,
//                 });
//                 console.log(`Published task list for user ${user._id}`);
//             } else {
//                 console.log(`No tasks found for user ${user._id}`);
//             }
//         }
//     } catch (error) {
//         console.error('Error publishing task lists:', error);
//     }
// };


export const publishTaskList = async (taskList) => {
    try {
        // console.log(taskList, "taskList");
        const message = { tasks: taskList };
        await sendMessage('task_list', message);
        console.log('Task list published:', message);
    } catch (error) {
        console.error('Error publishing task list:', error);
    }
};

// export const consumeMessage = async (queue) => {
//     // consumeSuggestions
//     await channel.consume(queue, (message) => {
//         const suggestions = JSON.parse(message.content.toString());
//         console.log('Received suggestions from RL service:', suggestions);

//         // Update database or notify front-end with suggestions
//         channel.ack(message);
//     });
// }

// export const consumeTaskSuggestions = async () => {
//     await consumeMessage('task_suggestion_queue', async (message) => {
//         try {
//             console.log('Received raw message:', message);

//             if (!message || !message.content) {
//                 console.error('Invalid or missing message object:', message);
//                 if (message?.fields?.deliveryTag) {
//                     channel.ack(message); // Acknowledge invalid messages to prevent requeueing
//                 }
//                 return;
//             }

//             // Parse message content
//             const parsedContent = JSON.parse(message.content.toString());

//             if (Array.isArray(parsedContent)) {
//                 console.log('Message is an array. Expected object:', parsedContent);
//                 channel.ack(message); // Acknowledge the message to avoid reprocessing
//                 return;
//             }

//             console.log('Parsed message content:', parsedContent);

//             const { userId, suggestions } = parsedContent;
//             if (!userId || !Array.isArray(suggestions)) {
//                 console.error('Malformed message content:', parsedContent);
//                 channel.ack(message); // Acknowledge invalid messages
//                 return;
//             }

//             const tasks = await fetchTasksForUser(userId);
//             if (!tasks || tasks.length === 0) {
//                 console.error(`No tasks found for userId: ${userId}`);
//                 channel.ack(message);
//                 return;
//             }

//             if (tasks.length !== suggestions.length) {
//                 console.error('Mismatch between tasks and suggestions length:', {
//                     tasksLength: tasks.length,
//                     suggestionsLength: suggestions.length,
//                 });
//                 channel.ack(message);
//                 return;
//             }

//             // Map suggestions to tasks
//             tasks.forEach((task, index) => {
//                 task.ai_suggestion = suggestions[index];
//                 updateTaskWithSuggestion(task._id, task.ai_suggestion); // Replace with your update logic
//             });

//             console.log('Task suggestions updated successfully for user:', userId);

//             // Acknowledge message
//             channel.ack(message);
//         } catch (error) {
//             console.error('Error processing message:', error);
//             if (message?.fields?.deliveryTag) {
//                 channel.ack(message); // Safeguard: Acknowledge message to prevent it from being stuck
//             }
//         }
//     });
// };

// export const consumeTaskSuggestions = async () => {
//     await consumeMessage('task_suggestion_queue', async (message) => {
//         console.log('Received raw message:', message);
//         // const messageContent = JSON.parse(message.content.toString());
//         // const rawContent = message.content.toString();
//         // const messageContent = JSON.parse(rawContent);
//         // const parsedContent = parseMessageContent(messageContent);
//         // if (!parsedContent) {
//         //     console.error('Malformed message. Acknowledging and skipping.');
//         //     return acknowledgeMessage(message);
//         // }

//         // const [userId, suggestions] = parsedContent;

//         // // Log userId and suggestions for debugging
//         // console.log('Parsed userId:', userId);
//         // console.log('Parsed suggestions:', suggestions);
//         const userId = message?.userId
//         const suggestions = message?.suggestions

//         try {
//             const tasks = await fetchTasksForUser(userId);

//             if (!tasks || tasks.length === 0) {
//                 console.warn(`No tasks found for userId: ${userId}`);
//             }

//             if (tasks.length !== suggestions.length) {
//                 console.error('Mismatch in task and suggestion counts:', {
//                     tasksLength: tasks.length,
//                     suggestionsLength: suggestions.length,
//                 });
//             }

//             tasks.forEach(async (task, index) => {
//                 const suggestion = suggestions[index];
//                 await updateTaskWithSuggestion(task._id, suggestion);
//             });

//             console.log(`Successfully processed suggestions for userId: ${userId}`);
//         } catch (error) {
//             console.error('Error processing tasks for userId:', userId, error);
//         }
//     });
// };

export const consumeTaskSuggestions = async () => {
    await consumeMessage('task_suggestion_queue', async (message) => {
        console.log('Received raw message:', message);

        const userId = message?.userId;
        const suggestions = message?.suggestions;

        try {
            // Fetch all tasks for the user
            const tasks = await fetchTasksForUser(userId);

            if (!tasks || tasks.length === 0) {
                console.warn(`No tasks found for userId: ${userId}`);
            }

            if (tasks.length !== suggestions.length) {
                console.error('Mismatch in task and suggestion counts:', {
                    tasksLength: tasks.length,
                    suggestionsLength: suggestions.length,
                });
            }

            // Get today's date
            const today = new Date().toLocaleDateString(); // Current date in 'MM/DD/YYYY' format

            // Filter tasks for the current date based on plannedStartTime and dueDate
            const todaysTasks = tasks.filter(task => {
                const taskPlannedDate = task.plannedStartTime.date ? new Date(task.plannedStartTime.date).toLocaleDateString() : null;
                const taskDueDate = new Date(task.dueDate.startDate).toLocaleDateString();

                // Check if plannedStartTime is today or if the dueDate is today
                return (taskPlannedDate === today || taskDueDate === today);
            });

            if (todaysTasks.length === 0) {
                console.warn('No tasks found for today.');
            }

            // Process only today's tasks
            todaysTasks.forEach(async (task, index) => {
                const suggestion = suggestions[index];
                await updateTaskWithSuggestion(task._id, suggestion);
            });

            console.log(`Successfully processed suggestions for userId: ${userId}`);
        } catch (error) {
            console.error('Error processing tasks for userId:', userId, error);
        }
    });
};

// Example function to fetch tasks for a user
const fetchTasksForUser = async (userId) => {
    // Fetch tasks from MongoDB based on userId
    return await Task.find({ userId: userId }).sort({ _id: 1 });
};



// Example function to update task with the suggestion
const updateTaskWithSuggestion = async (taskId, aiSuggestion) => {
    // Replace this with the logic to update a task in the database
    await Task.updateOne({ _id: taskId }, { $set: { ai_suggestion: aiSuggestion } });
};


export { connectRabbitMQ, getRabbitMQChannel };
