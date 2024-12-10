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
        const tasks = await Task.find({ userId: userId }).sort({ _id: asc });
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


// Update a task
const updateTask = async (req, res) => {
    try {
        const { id } = req.params;
        const updatedTask = await Task.findOneAndUpdate({ _id: id, userId: req.user.id }, req.body, { new: true });
        if (!updatedTask) return res.status(404).json({ error: 'Task not found' });
        console.log(updatedTask, "updatedTask");
        sendMessage('task_updates', updatedTask);


        //to RL service - check wether the task is completed/deferred
        // sendMessage('taskQueue', updatedTask);
        // if (updatedTask?.status === "completed")
        sendMessage('taskQueue', updatedTask);

        await redisClient.del('tasks:*');

        res.status(200).json({ message: 'Task updated successfully', data: updatedTask });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

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

export { createTask, getAllTasks, updateTask, deleteTask };
