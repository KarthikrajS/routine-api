import dotenv from "dotenv"
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import connectToDB from './utils/db.js';
import taskRoutes from './routes/taskRoutes.js';
import { connectRabbitMQ, consumeTaskSuggestions, fetchUserList, publishTaskList } from "./utils/rabbitmq.js";
import redisClient from "./utils/redisClient.js";
import cron from 'node-cron';
import { fetchTasksForUser, getAllTasks } from "./controllers/taskController.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;


// const fetchDailyTaskList = async () => {
//     try {
//         // const userLis
//         const taskList = await getAllTasks(); // Replace with your actual DB/service call
//         return taskList;
//     } catch (error) {
//         console.error('Error fetching task list:', error);
//         return [];
//     }
// };

// Schedule a task to run every day at midnight
// cron.schedule('* * * * *', async () => {
//     console.log('Running daily task to publish task list...');
//     const taskList = await fetchDailyTaskList();

//     if (taskList.length > 0) {
//         await publishTaskListForAllUsers(taskList);
//     } else {
//         console.log('No tasks to publish for today.');
//     }
// }, {
//     timezone: 'UTC', // Set the timezone if needed
// });
// cron.schedule('1 0 * * *', -> 12:01 AM every day) {
cron.schedule('1 0 * * *', async () => { // Adjust time based on User Service cron
    console.log('Running daily routine to fetch user tasks and publish task list...');

    try {
        const userList = await fetchUserList();

        if (userList.length === 0) {
            console.log('No users found in the queue.');
            return;
        }

        console.log(`Processing tasks for ${userList.length} users...`);
        for (const user of userList) {
            // Fetch user-specific task
            const tasks = await fetchTasksForUser(user._id); // Replace with actual logic
            if (tasks.length > 0) {
                // Publish task list for the user
                await publishTaskList(tasks);
            }
        }

        console.log('Finished processing all users.');
    } catch (error) {
        console.error('Error in daily routine:', error);
    }
}, {
    timezone: 'UTC', // Adjust timezone if needed
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

// Routes
app.use('/tasks', taskRoutes);

// const queue = 'task_created';
connectRabbitMQ().then(async() => {

    await consumeTaskSuggestions()
    // Consume messages from the queue
    // channel.consume('taskQueue', async (message) => {
    //     const suggestions = JSON.parse(message.content.toString());
    //     console.log('Received suggestions from RL service:', suggestions);

    //     // Update database or notify front-end with suggestions
    //     channel.ack(message);
    // });

    //For task produce
    // channel.assertQueue(queue, { durable: true });
    // channel.sendToQueue(queue, Buffer.from(JSON.stringify("taskData")), {
    //     persistent: true,
    // });
});

redisClient.connect().then(() =>
    console.log('Connected to Redis')
)
// Start server
connectToDB().then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch(err => console.error('Database connection failed:', err));
