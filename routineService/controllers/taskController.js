<<<<<<< Updated upstream
import Task from '../models/taskModel.js';
=======
// import { client } from '../index.js';
// import { client } from '../middleware/index.js';
import Task from '../models/taskModel.js';
import { sendMessage } from '../utils/rabbitmq.js';
import redisClient from '../utils/redisClient.js';
>>>>>>> Stashed changes

// Create a new task
const createTask = async (req, res) => {
    try {
        console.log(req.body, "req.body");
        const task = new Task(req.body);
<<<<<<< Updated upstream

        await task.save();
=======
        await redisClient.del('tasks:*');
        await task.save();
        sendMessage('task_creation', task);
>>>>>>> Stashed changes
        res.status(201).json({ message: "Task created Successfully", data: task });
    } catch (err) {
        console.log(err, "err");
        res.status(500).json({ error: err.message });
    }
};

// Get all tasks
const getAllTasks = async (req, res) => {
    try {
<<<<<<< Updated upstream
        const tasks = await Task.find();
        res.status(200).json(tasks);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
=======
        const userId = req.user.id
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

>>>>>>> Stashed changes

// Update a task
const updateTask = async (req, res) => {
    try {
        const { id } = req.params;
<<<<<<< Updated upstream
        const updatedTask = await Task.findByIdAndUpdate(id, req.body, { new: true });
        if (!updatedTask) return res.status(404).json({ error: 'Task not found' });
        res.status(200).json({message: 'Task updated successfully', data: updatedTask});
=======
        const updatedTask = await Task.findOneAndUpdate({ _id: id, userId: req.user.id }, req.body, { new: true });
        if (!updatedTask) return res.status(404).json({ error: 'Task not found' });
        console.log(updatedTask, "updatedTask");
        sendMessage('task_updates', updatedTask);


        //to RL service - check wether the task is completed/deferred
        // sendMessage('taskQueue', updatedTask);
        // if (updatedTask?.status === "completed")
        sendMessage('taskQueue', { tasks: [updatedTask] });
        await redisClient.del('tasks:*');

        res.status(200).json({ message: 'Task updated successfully', data: updatedTask });
>>>>>>> Stashed changes
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Delete a task
const deleteTask = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedTask = await Task.findByIdAndDelete(id);
<<<<<<< Updated upstream
=======
        await redisClient.del('tasks:*');
>>>>>>> Stashed changes
        if (!deletedTask) return res.status(404).json({ error: 'Task not found' });
        res.status(200).json({ message: 'Task deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export { createTask, getAllTasks, updateTask, deleteTask };
