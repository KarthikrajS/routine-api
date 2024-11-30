import mongoose from 'mongoose';

const connectToDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        })
        console.log('Connected to MongoDB');
    } catch (err) {
        console.error('Error connecting to database:', err);
        throw err;
    }
};

export default connectToDB;
