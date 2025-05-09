import express from 'express';
import { createTask, getAllTasks, updateTask, deleteTask, getTodayTask } from '../controllers/taskController.js';
import { authMiddleware, cacheMiddleware } from '../middleware/index.js';
const router = express.Router();


router.post('/', authMiddleware, createTask);            // Create a new task
router.get('/', authMiddleware, cacheMiddleware, getAllTasks);
router.get('/:id', authMiddleware, cacheMiddleware, getTodayTask)            // Get all tasks
router.put('/:id', authMiddleware, updateTask);          // Update a task
router.delete('/:id', authMiddleware, deleteTask);       // Delete a task

// router.post('/update-status', authMiddleware, updateTaskStatus);

export default router
