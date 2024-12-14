from fastapi import FastAPI, HTTPException
from rl_model import train_model, get_suggestions
import pika
import json

app = FastAPI()

# RabbitMQ Connection Parameters
RABBITMQ_URL = "amqp://guest:guest@localhost:5672"
QUEUE_NAME = "taskQueue"

def callback(ch, method, properties, body):
    try:
        print(f"Raw message body: {body}")
        task_data = json.loads(body)
        print(f"Received task data: {task_data}")

        # Process the task data
        train_model(task_data)

        # Acknowledge message processing
        ch.basic_ack(delivery_tag=method.delivery_tag)
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON: {e}")
    except Exception as e:
        print(f"General error: {e}")
        print(f"Error processing task data: {e}")
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

def start_consumer():
    try:
        connection = pika.BlockingConnection(pika.URLParameters(RABBITMQ_URL))
        channel = connection.channel()

        # Declare the queue (must match producer)
        channel.queue_declare(queue=QUEUE_NAME, durable=True)

        # Start consuming messages
        channel.basic_consume(queue=QUEUE_NAME, on_message_callback=callback)
        print("Waiting for messages in 'taskQueue'...")
        channel.start_consuming()
    except Exception as e:
        print(f"Error in RabbitMQ consumer: {e}")

if __name__ == "__main__":
    start_consumer()
