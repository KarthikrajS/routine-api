import pika
import json
from rl_model import train_model, get_suggestions

def process_task_update(ch, method, properties, body):
    task_update = json.loads(body)
    print(f"Received task update: {task_update}")
    train_model(task_update)
    # Process the task update (train model or generate suggestions)
    # Call RL training or suggestion logic here
    
    
    ch.basic_ack(delivery_tag=method.delivery_tag)

def publish_suggestions(suggestions):
    connection = pika.BlockingConnection(pika.ConnectionParameters('amqp://0.0.0.0:5672'))
    channel = connection.channel()

    queue = 'rl_suggestions'
    channel.queue_declare(queue=queue, durable=True)
    channel.basic_publish(
        exchange='',
        routing_key=queue,
        body=json.dumps(suggestions),
        properties=pika.BasicProperties(delivery_mode=2),
    )

    print('Suggestions sent to Task Service:', suggestions)
    connection.close()
    
connection = pika.BlockingConnection(pika.ConnectionParameters('amqp://0.0.0.0:5672'))
channel = connection.channel()

channel.queue_declare(queue='taskQueue', durable=True)
channel.basic_consume(queue='taskQueue', on_message_callback=process_task_update)

print('Waiting for task updates...')
channel.start_consuming()