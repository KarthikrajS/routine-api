import pika
import json
from rl_model import train_model, get_suggestions
RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672")

def process_task_update(ch, method, properties, body):
    try:
        task_update = json.loads(body)
        print(f"Received task update: {task_update}")

        # Ensure task_update has the required keys
        if len(task_update) != 2:
            raise ValueError("Task update is missing or has an invalid structure")
        
        user_id = task_update[0]  # userId (it could be an ObjectId or string)
        suggestions = task_update[1]  # suggestions list
        
        if not isinstance(suggestions, list):
            raise ValueError("Suggestions should be in a list format")

        print(f"User ID: {user_id}, Suggestions: {suggestions}")

        # Assuming 'train_model' is used to process the suggestions
        train_model(task_update)  # Assuming 'task_update' is the correct format

        # Acknowledge the message after processing
        ch.basic_ack(delivery_tag=method.delivery_tag)
        
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON: {e}")
        ch.basic_nack(delivery_tag=method.delivery_tag)
    except ValueError as e:
        print(f"Error in task update: {e}")
        ch.basic_nack(delivery_tag=method.delivery_tag)


def publish_suggestions(user_id, suggestions):
    # Ensure that the message is in the correct format: [user_id, [suggestion0, suggestion1, ...]]
    message = [str(user_id), suggestions]  # Convert ObjectId to string if needed
    
    # Publish the message to RabbitMQ
    connection = pika.BlockingConnection(pika.ConnectionParameters(RABBITMQ_URL))
    channel = connection.channel()
    queue = 'task_suggestion_queue'
    
    channel.queue_declare(queue=queue, durable=True)
    channel.basic_publish(
        exchange='',
        routing_key=queue,
        body=json.dumps(message),  # Serialize as JSON
        properties=pika.BasicProperties(
            delivery_mode=2  # Make the message persistent
        )
    )
    print(f"Published message to 1 {queue}: {message}")
    connection.close()

connection = pika.BlockingConnection(pika.ConnectionParameters(RABBITMQ_URL))
channel = connection.channel()

channel.queue_declare(queue='taskQueue', durable=True)
channel.basic_consume(queue='taskQueue', on_message_callback=process_task_update)

print('Waiting for task updates...')
channel.start_consuming()
