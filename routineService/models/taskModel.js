import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    title: { type: String, required: true },
    description: { type: String },
    priority: { type: Number },
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
    taskType:{type:String, enum:["Personal care","Meals","Transportation","Household chores","Leisure","Exercise","Work","Social","Incidental","Coordinated","Planned","Miscellaneous"]},
    status: { type: String, enum: ['pending', 'in_progress', 'completed', 'deferred'], default: 'pending' },
    feedback: { type: String },
    assigntTo: {
        _id: { type: mongoose.Schema.Types.ObjectId },
        username: { type: String },
    },
    ai_suggestion:{
        type : Boolean
    }

});

const Task = mongoose.model('Task', taskSchema);
export default Task;
