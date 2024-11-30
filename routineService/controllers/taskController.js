import Task from '../models/taskModel.js';

// Create a new task
const createTask = async (req, res) => {
    try {
        console.log(req.body, "req.body");
        const task = new Task(req.body);

        await task.save();
        res.status(201).json({ message: "Task created Successfully", data: task });
    } catch (err) {
        console.log(err, "err");
        res.status(500).json({ error: err.message });
    }
};

// Get all tasks
const getAllTasks = async (req, res) => {
    try {
        const tasks = await Task.find();
        res.status(200).json(tasks);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Update a task
const updateTask = async (req, res) => {
    try {
        const { id } = req.params;
        const updatedTask = await Task.findByIdAndUpdate(id, req.body, { new: true });
        if (!updatedTask) return res.status(404).json({ error: 'Task not found' });
        res.status(200).json({message: 'Task updated successfully', data: updatedTask});
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Delete a task
const deleteTask = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedTask = await Task.findByIdAndDelete(id);
        if (!deletedTask) return res.status(404).json({ error: 'Task not found' });
        res.status(200).json({ message: 'Task deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export { createTask, getAllTasks, updateTask, deleteTask };
