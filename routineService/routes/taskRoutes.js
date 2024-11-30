import express from 'express';
import { createTask, getAllTasks, updateTask, deleteTask } from '../controllers/taskController.js';
const router = express.Router();

router.post('/', createTask);            // Create a new task
router.get('/', getAllTasks);            // Get all tasks
router.put('/:id', updateTask);          // Update a task
router.delete('/:id', deleteTask);       // Delete a task

export default router
