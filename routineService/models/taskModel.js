import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    title: { type: String, required: true },
    description: { type: String },
    priority: { type: String },
    dueDate: {
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
    },
    plannedStartTime: {
        date: { type: Date },
        time: { type: String },
    },
    actualStartAt: {
        date: { type: Date },
        time: { type: String },
    },
    completedAt: {
        date: { type: Date },
        time: { type: String },
    },
    status: { type: String, enum: ['pending', 'in_progress', 'completed'], default: 'pending' },
    assigntTo: {
        _id: { type: mongoose.Schema.Types.ObjectId },
        username: { type: String },
    },
});

const Task = mongoose.model('Task', taskSchema);
export default Task;
