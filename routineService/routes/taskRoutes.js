import express from 'express';
import { createTask, getAllTasks, updateTask, deleteTask } from '../controllers/taskController.js';
<<<<<<< Updated upstream
const router = express.Router();

router.post('/', createTask);            // Create a new task
router.get('/', getAllTasks);            // Get all tasks
router.put('/:id', updateTask);          // Update a task
router.delete('/:id', deleteTask);       // Delete a task
=======
import {authMiddleware,  cacheMiddleware } from '../middleware/index.js';
const router = express.Router();

router.post('/', authMiddleware, createTask);            // Create a new task
router.get('/', authMiddleware, cacheMiddleware, getAllTasks);            // Get all tasks
router.put('/:id', authMiddleware, updateTask);          // Update a task
router.delete('/:id', authMiddleware, deleteTask);       // Delete a task
>>>>>>> Stashed changes

export default router
