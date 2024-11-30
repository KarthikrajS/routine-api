import amqp from 'amqplib';

let channel, connection;

const connectRabbitMQ = async () => {
    try {
        connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
        channel = await connection.createChannel();
        console.log('Connected to RabbitMQ');
        return channel;
    } catch (err) {
        console.error('Failed to connect to RabbitMQ:', err);
        process.exit(1);
    }
};

const getRabbitMQChannel = () => {
    if (!channel) throw new Error('RabbitMQ channel is not initialized');
    return channel;
};

export { connectRabbitMQ, getRabbitMQChannel };
