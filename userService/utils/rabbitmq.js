import amqp from 'amqplib';

export const connectRabbitMQ = async () => {
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    const channel = await connection.createChannel();

    // Listen to task events
    await channel.assertQueue('task_creation', { durable: true });
    await channel.assertQueue('task_updates', { durable: true });
    

    channel.consume('task_creation', (msg) => {
        const task = JSON.parse(msg.content.toString());
        console.log('New Task Created:', task);
        channel.ack(msg);
        // Process or store the task as needed
    });

    channel.consume('user_events', (msg) => {
        const data = JSON.parse(msg.content.toString());
        if (data.event === 'USER_REGISTERED') {
            console.log('New user registered:', data.user);
            // Simulate sending a welcome notification
            sendWelcomeNotification(data.user);
        }
        channel.ack(msg);
    });

    channel.consume('task_updates', (msg) => {
        const task = JSON.parse(msg.content.toString());
        console.log('Task Updated:', task);
        channel.ack(msg);
        // Process or update user-specific data
    });

    console.log('RabbitMQ consumer connected.');
};
// Simulate sending a welcome notification (e.g., email)
const sendWelcomeNotification = (user) => {
    console.log(`Sending welcome notification to ${user?.newUser?.name} (${user?.newUser?.email})`);
};
