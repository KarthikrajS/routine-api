# main.py
from fastapi import FastAPI, HTTPException
from contextlib import asynccontextmanager
from rl_model import train_model, get_suggestions, get_weekly_suggestions
import pika
import json
import threading
import os
import time
import asyncio
from aio_pika import connect_robust, Message, IncomingMessage, ExchangeType
# RabbitMQ Connection Parameters

RABBITMQ_URL = "amqp://guest:guest@rabbitmq-1-t1xx.onrender.com:5672"
TASK_QUEUE = "taskQueue"
ANALYSIS_QUEUE = "analysisQueue"
TASK_SUGGESTION_QUEUE = "task_suggestion_queue"
print(RABBITMQ_URL,"RABBITMQ_URL")
# In-memory storage for task and feedback data
daily_task_data = []
daily_user_feedback = []


async def connect_rabbitmq(queue_name):
    connection = await connect_robust(RABBITMQ_URL)
    channel = connection.channel()
    channel.queue_declare(queue=queue_name, durable=True)
    return channel


def publish_message(queue_name, message):
    channel = asyncio.run(connect_rabbitmq(queue_name))
    try:
        encoded_message = json.dumps(message)
        channel.basic_publish(
            exchange='',
            routing_key=queue_name,
            body=encoded_message,
            properties=pika.BasicProperties(delivery_mode=2)  # Persistent message
        )
        print(f"Published message to {queue_name}: {encoded_message}")
    finally:
        channel.close()



def process_task_message(task_message):
    global daily_task_data
    try:
        task = json.loads(task_message)
        print(f"Processing task: {task}")
        daily_task_data.append(task)
        train_model(daily_task_data)
    except Exception as e:
        print(f"Error processing task message: {e}")


def process_feedback_message(feedback_message):
    global daily_user_feedback
    try:
        feedback = json.loads(feedback_message)
        print(f"Processing feedback: {feedback}")
        daily_user_feedback.append(feedback)
    except Exception as e:
        print(f"Error processing feedback message: {e}")


# def start_consumer():
#     connection = pika.BlockingConnection(pika.URLParameters(RABBITMQ_URL))
#     channel = connection.channel()
#     channel.queue_declare(queue='task_list', durable=True)

#     def callback(ch, method, properties, body):
#         try:
#             print(method, "method")
#             print(f"Received task list: {body}")
#             task_list = json.loads(body)
            
#             if 'tasks' not in task_list or not isinstance(task_list['tasks'], list):
#                 print("Malformed task list. Acknowledging and skipping.")
#                 ch.basic_ack(delivery_tag=method.delivery_tag)
#                 return
#             tasks = task_list['tasks']
#             if not tasks:
#                 print("Empty task list. Acknowledging and skipping.")
#                 ch.basic_ack(delivery_tag=method.delivery_tag)
#                 return
#             # print(tasks[0],"tasks[0]")
#             user_id = str(tasks[0].get("userId"))
#             if not user_id:
#                 print("Missing userId in tasks. Acknowledging and skipping.")
#                 ch.basic_ack(delivery_tag=method.delivery_tag)
#                 return
            
#             # Generate suggestions based on priority threshold (e.g., > 0.5)
#             suggestions = [1 if float(task.get('priority', 0)) > 0.5 else 0 for task in tasks]
#             print(suggestions, "suggestions")
            
#             publish_message(TASK_SUGGESTION_QUEUE, [user_id, suggestions])
#         except Exception as e:
#             print(f"Error processing task list: {e}")
#         finally:
#             ch.basic_ack(delivery_tag=method.delivery_tag)

#     channel.basic_consume(queue=TASK_QUEUE, on_message_callback=callback)
#     print('Waiting for messages...')
#     channel.start_consuming()
async def start_consumer():
    """Start the RabbitMQ consumer."""
    max_retries = 5
    retry_delay = 5  # seconds

    for attempt in range(max_retries):
        try:
            print(f"Attempting connection to RabbitMQ at {RABBITMQ_URL}")
            connection = await connect_robust(RABBITMQ_URL)
            print("Successfully connected to RabbitMQ")
            # connection = await connect_robust(RABBITMQ_URL)
            async with connection:
                print("Connected to RabbitMQ.")
                channel = await connection.channel()
                await channel.set_qos(prefetch_count=1)

                queue = await channel.declare_queue(TASK_QUEUE, durable=True)

                print("Starting consumer. Waiting for messages...")
                async for message in queue:
                    async with message.process():
                        print(f"Processing message: {message.body.decode()}")
                        try:
                            await process_task_message(message.body)
                        except Exception as e:
                            print(f"Error processing message: {e}")

        except Exception as e:
            print(f"Connection attempt {attempt + 1} failed: {e}")
            if attempt < max_retries - 1:
                await asyncio.sleep(retry_delay * (2 ** attempt))  # Exponential backoff
            else:
                print("Max retries reached. Unable to connect to RabbitMQ.")
                raise


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan, including the RabbitMQ consumer."""
    print("Starting RabbitMQ consumer...")
    consumer_task = asyncio.create_task(start_consumer())
    try:
        yield
    finally:
        print("Stopping RabbitMQ consumer...")
        consumer_task.cancel()
        try:
            await consumer_task
        except asyncio.CancelledError:
            print("Consumer task cancelled.")

app = FastAPI(lifespan=lifespan)

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.get("/suggestions/{period}")
async def get_analysis_suggestions(period: str):
    global daily_task_data

    try:
        if period not in {"day", "week"}:
            raise HTTPException(status_code=400, detail="Invalid period. Use 'day' or 'week'.")

        # If 'daily_task_data' is a list, convert it to the expected dictionary format
        if isinstance(daily_task_data, list):
            formatted_task_data = {"tasks": daily_task_data}

        if period == "day":
            suggestions = get_suggestions(formatted_task_data)
        else:
            weekly_suggestions = get_weekly_suggestions(formatted_task_data)
            suggestions = weekly_suggestions['suggestions']

        return {"period": period, "suggestions": suggestions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating suggestions: {str(e)}")
