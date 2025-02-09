// import { client } from '../index.js';
// import { client } from '../middleware/index.js';
import Task from '../models/taskModel.js';
import { sendMessage } from '../utils/rabbitmq.js';
import redisClient from '../utils/redisClient.js';

// Create a new task
const createTask = async (req, res) => {
    try {
        console.log(req.body, "req.body");
        const task = new Task(req.body);
        await redisClient.del('tasks:*');
        await task.save();
        sendMessage('task_creation', task);
        sendMessage('taskQueue', task);
        res.status(201).json({ message: "Task created Successfully", data: task });
    } catch (err) {
        console.log(err, "err");
        res.status(500).json({ error: err.message });
    }
};

export const fetchTasksForUser = async (userId) => {
    try {
        const tasks = await Task.find({ userId: userId }).sort({ _id: 1 });
        if (!tasks || tasks.length === 0) {
            console.warn(`No tasks found for userId: ${userId}`);
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

        return todaysTasks;
    } catch (error) {
        console.error(`Error fetching tasks for user ${userId}:`, error);
        return [];
    }
};
// Get all tasks
const getAllTasks = async (req, res) => {
    try {
        const userId = req.user._id
        const { page = 1, limit = 10, view } = req.query;
        const cacheKey = `tasks:${userId}:${page}:${limit}`;
        // :${JSON.stringify(filters)}


        console.log(view, "view");
        if (view == "calendar") {
            var tasks = await Task.find({ userId: req.user.id });

            res.status(200).json(tasks);
        }
        if (view == "list") {
            var tasks = await Task.find({ userId: req.user.id })
                .skip((page - 1) * limit)
                .limit(limit);

            const totalTasks = await Task.countDocuments({ userId: req.user.id });
            redisClient.set(cacheKey, 3600, JSON.stringify(tasks));
            res.json({
                tasks,
                totalTasks,
                totalPages: Math.ceil(totalTasks / limit),
                currentPage: page,
            });
        }
    }
    catch (err) {
        console.log(err, "asdadda");
        res.status(500).json({ error: err.message });
    }
}


const fetchTasksForDate = async (userId, date) => {
    const tasks = await Task.find({ userId });
    const formattedDate = new Date(date).toLocaleDateString();

    return tasks.filter(task => {
        const taskPlannedDate = task.plannedStartTime?.date
            ? new Date(task.plannedStartTime.date).toLocaleDateString()
            : null;
        const taskDueDate = new Date(task.dueDate.startDate).toLocaleDateString();

        return (taskPlannedDate === formattedDate || taskDueDate === formattedDate);
    });
};

// Update a task
const updateTask = async (req, res) => {
    try {
        const { id } = req.params;
        // const userId = req.user._id;
        // const status = req.body.status
        const updatedTask = await Task.findOneAndUpdate({ _id: id, userId: req.user.id }, req.body, { new: true });
        console.log(updatedTask, "updatedTask");
        if (!updatedTask) return res.status(404).json({ error: 'Task not found' });

        // Publish a message to RabbitMQ for the user service
        // if (status === "completed") {
        //     await sendMessage('task_updates', {
        //         id,
        //         userId,
        //         status,
        //         dueDate: updateTask.dueDate,
        //     });
        // }
        await sendMessage('task_updates', updatedTask);


        //to RL service - check wether the task is completed/deferred
        sendMessage('taskQueue', updatedTask);
        // if (updatedTask?.status === "completed")
        // sendMessage('taskQueue', updatedTask);

        await redisClient.del('tasks:*');

        res.status(200).json({ message: 'Task updated successfully', data: updatedTask });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
// const updateTaskStatus = async (req, res) => {
//     try {
//         const { taskId, status } = req.body;
//         const userId = req.user._id;

//         const task = await Task.findOne({ _id: taskId, userId });
//         if (!task) {
//             return res.status(404).json({ error: "Task not found" });
//         }

//         task.status = status;
//         await task.save();

//         // Publish a message to RabbitMQ for the user service
//         if (status === "completed") {
//             await sendMessage('task_updates', {
//                 taskId,
//                 userId,
//                 status,
//                 dueDate: task.dueDate,
//             });
//         }

//         res.status(200).json({ message: "Task status updated successfully", task });
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// };


// const updateTaskStatus = async (req, res) => {
//     try {
//         const { taskId, status } = req.body;
//         const userId = req.user._id;

//         const task = await Task.findOne({ _id: taskId, userId });
//         if (!task) {
//             return res.status(404).json({ error: "Task not found" });
//         }

//         task.status = status;
//         await task.save();

//         if (status === "completed") {
//             const user = await User.findById(userId);
//             const today = new Date().setHours(0, 0, 0, 0);

//             // Update streak
//             if (user.lastCompletedDay) {
//                 const lastDay = new Date(user.lastCompletedDay).setHours(0, 0, 0, 0);
//                 if (today - lastDay === 86400000) { // 1 day difference
//                     user.streak += 1;
//                 } else if (today - lastDay > 86400000) {
//                     user.streak = 1; // Reset streak
//                 }
//             } else {
//                 user.streak = 1; // First completed day
//             }
//             user.lastCompletedDay = today;

//             // Calculate daily progress
//             const completedTasks = await Task.countDocuments({ userId, status: "completed", "dueDate.startDate": { $lte: today }, "dueDate.endDate": { $gte: today } });
//             const totalTasks = await Task.countDocuments({ userId, "dueDate.startDate": { $lte: today }, "dueDate.endDate": { $gte: today } });

//             user.progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

//             await user.save();
//         }

//         res.status(200).json({ message: "Task status updated successfully", task });
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// };

// const { sendMessage } = require('./rabbitmq'); // Import RabbitMQ utility


// Delete a task
const deleteTask = async (req, res) => {
    try {
        const { id } = req.params;
        // const deletedTask = await Task.findByIdAndDelete(id);
        const deletedTask = await Task.findOneAndUpdate({ _id: id, userId: req.user.id }, req.body, { new: true });
        await redisClient.del('tasks:*');
        if (!deletedTask) return res.status(404).json({ error: 'Task not found' });
        sendMessage('analysisQueue', deletedTask)
        res.status(200).json({ message: 'Task deleted successfully', data: deletedTask });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export { createTask, getAllTasks, updateTask, deleteTask, };
