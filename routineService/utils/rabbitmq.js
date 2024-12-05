import amqp from 'amqplib';

let channel, connection;

const connectRabbitMQ = async () => {
    try {
        connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
        channel = await connection.createChannel();
<<<<<<< Updated upstream
=======

        //For RL serice
        await channel.assertQueue('taskQueue', { durable: true });


        await channel.assertQueue('task_creation', { durable: true });
        await channel.assertQueue('task_updates', { durable: true });
>>>>>>> Stashed changes
        console.log('Connected to RabbitMQ');
        return channel;
    } catch (err) {
        console.error('Failed to connect to RabbitMQ:', err);
        process.exit(1);
    }
};

<<<<<<< Updated upstream
=======
export const sendMessage = async (queue, message) => {
    try {
        await channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), { persistent: true });
        console.log(`Message sent to ${queue}:`, message);
    } catch (error) {
        console.error('Error sending message:', error);
    }
};

export const consumeMessage = async(queue) => {
    // consumeSuggestions
    await channel.consume(queue, (message) => {
        const suggestions = JSON.parse(message.content.toString());
        console.log('Received suggestions from RL service:', suggestions);

        // Update database or notify front-end with suggestions
        channel.ack(message);
    });
}

export const closeRabbitMQ = async () => {
    await channel.close();
    await connection.close();
    console.log('RabbitMQ connection closed.');
};

>>>>>>> Stashed changes
const getRabbitMQChannel = () => {
    if (!channel) throw new Error('RabbitMQ channel is not initialized');
    return channel;
};

export { connectRabbitMQ, getRabbitMQChannel };
