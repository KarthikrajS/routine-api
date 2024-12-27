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
import aio_pika
from typing import List, Dict, Any

# RabbitMQ Connection Parameters
RABBITMQ_URL = os.getenv("RABBITMQ_URL","amqps://aedzelrz:WyaTGqjpwTkTlac4KeY6l4qCcCIvobca@campbell.lmq.cloudamqp.com/aedzelrz")
TASK_QUEUE = "taskQueue"
ANALYSIS_QUEUE = "analysisQueue"
TASK_SUGGESTION_QUEUE = "task_suggestion_queue"
print(RABBITMQ_URL,"RABBITMQ_URL")
# In-memory storage for task and feedback data
daily_task_data = []
daily_user_feedback = []


# async def connect_rabbitmq(queue_name):
#     connection = await connect_robust(RABBITMQ_URL)
#     channel = connection.channel()
#     channel.queue_declare(queue=queue_name, durable=True)
#     return channel
async def connect_rabbitmq():
    """Establish a robust RabbitMQ connection."""
    return await connect_robust(RABBITMQ_URL)


# def publish_message(queue_name, message):
#     channel = asyncio.run(connect_rabbitmq(queue_name))
#     try:
#         encoded_message = json.dumps(message)
#         channel.basic_publish(
#             exchange='',
#             routing_key=queue_name,
#             body=encoded_message,
#             properties=pika.BasicProperties(delivery_mode=2)  # Persistent message
#         )
#         print(f"Published message to {queue_name}: {encoded_message}")
#     finally:
#         channel.close()
# async def publish_message(queue_name: str, message: List[Any]):
   
#     connection = await aio_pika.connect_robust(RABBITMQ_URL)
#     async with connection:
#         channel = await connection.channel()
#         queue = await channel.declare_queue(queue_name, durable=True)
#         await channel.default_exchange.publish(
#             aio_pika.Message(body=json.dumps(message).encode()),
#             routing_key=queue.name
#         )
async def publish_message(queue_name: str, message: dict):
    """Publish a message to a RabbitMQ queue."""
    connection = await connect_rabbitmq()
    async with connection:
        channel = await connection.channel()
        queue = await channel.declare_queue(queue_name, durable=True)
        await channel.default_exchange.publish(
            Message(body=json.dumps(message).encode()),
            routing_key=queue.name
        )
        print(f"Message published to {queue_name}: {message}")

async def process_task_list_message(body: bytes):
    """
    Process a task list message from the task_list queue.

    Args:
        body (bytes): The message body received from the queue.
    """
    try:
        print(f"Received task list: {body.decode()}")
        task_list = json.loads(body.decode())
        
        if 'tasks' not in task_list or not isinstance(task_list['tasks'], list):
            print("Malformed task list. Acknowledging and skipping.")
            return
        tasks: List[Dict[str, Any]] = task_list['tasks']
        if not tasks:
            print("Empty task list. Acknowledging and skipping.")
            return
        
        user_id = str(tasks[0].get("userId"))
        if not user_id:
            print("Missing userId in tasks. Acknowledging and skipping.")
            return
        
        # Generate suggestions based on priority threshold (e.g., > 0.5)
        suggestions = [1 if float(task.get('priority', 0)) > 0.5 else 0 for task in tasks]
        print(suggestions, "suggestions")
        
        await publish_message(TASK_SUGGESTION_QUEUE, [user_id, suggestions])
    except Exception as e:
        print(f"Error processing task list: {e}")


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

#     channel.basic_consume(queue="task_list", on_message_callback=callback)
#     print('Waiting for messages...')
#     channel.start_consuming()
# async def start_consumer():
#     """Start the RabbitMQ consumer."""
#     max_retries = 5
#     retry_delay = 5  # seconds

#     for attempt in range(max_retries):
#         try:
#             connection = await connect_robust(RABBITMQ_URL)
#             async with connection:
#                 print("Connected to RabbitMQ.")
#                 channel = await connection.channel()
#                 await channel.set_qos(prefetch_count=1)

#                 queue = await channel.declare_queue(TASK_QUEUE, durable=True)

#                 print("Starting consumer. Waiting for messages...")
#                 async for message in queue:
#                     async with message.process():
#                         try:
#                             process_task_message(message.body)
#                         except Exception as e:
#                             print(f"Error processing message: {e}")

#         except Exception as e:
#             print(f"Connection attempt {attempt + 1} failed: {e}")
#             if attempt < max_retries - 1:
#                 await asyncio.sleep(retry_delay * (2 ** attempt))  # Exponential backoff
#             else:
#                 print("Max retries reached. Unable to connect to RabbitMQ.")
#                 raise
async def start_consumer():
    """
    Start the RabbitMQ consumer for both TASK_QUEUE and task_list queues.
    """
    max_retries = 5
    retry_delay = 5  # seconds

    for attempt in range(max_retries):
        try:
            connection = await aio_pika.connect_robust(RABBITMQ_URL)
            async with connection:
                print("Connected to RabbitMQ.")
                channel = await connection.channel()
                await channel.set_qos(prefetch_count=1)

                # Declare and consume from TASK_QUEUE
                task_queue = await channel.declare_queue(TASK_QUEUE, durable=True)
                print("Starting consumer for TASK_QUEUE. Waiting for messages...")

                # Declare and consume from task_list queue
                task_list_queue = await channel.declare_queue("task_list", durable=True)
                print("Starting consumer for task_list queue. Waiting for messages...")

                # Use asyncio.gather to handle both queues concurrently
                await asyncio.gather(
                    consume_task_queue(task_queue),
                    consume_task_list_queue(task_list_queue)
                )

        except Exception as e:
            print(f"Connection attempt {attempt + 1} failed: {e}")
            if attempt < max_retries - 1:
                await asyncio.sleep(retry_delay * (2 ** attempt))  # Exponential backoff
            else:
                print("Max retries reached. Unable to connect to RabbitMQ.")
                raise
async def consume_task_queue(queue):
    """
    Consume messages from the TASK_QUEUE.

    Args:
        queue (aio_pika.Queue): The TASK_QUEUE to consume from.
    """
    async with queue.iterator() as queue_iter:
        async for message in queue_iter:
            async with message.process():
                try:
                    # Placeholder for TASK_QUEUE message processing
                    print(f"Received message from TASK_QUEUE: {message.body.decode()}")
                    # Add your TASK_QUEUE message processing logic here
                except Exception as e:
                    print(f"Error processing TASK_QUEUE message: {e}")

async def consume_task_list_queue(queue):
    """
    Consume messages from the task_list queue.

    Args:
        queue (aio_pika.Queue): The task_list queue to consume from.
    """
    async with queue.iterator() as queue_iter:
        async for message in queue_iter:
            async with message.process():
                try:
                    await process_task_list_message(message.body)
                except Exception as e:
                    print(f"Error processing task_list message: {e}")

async def consume_messages():
    """Consume messages from the RabbitMQ task queue."""
    connection = await connect_rabbitmq()
    async with connection:
        channel = await connection.channel()
        await channel.set_qos(prefetch_count=1)
        queue = await channel.declare_queue(TASK_QUEUE, durable=True)

        async with queue.iterator() as queue_iter:
            async for message in queue_iter:
                async with message.process():
                    try:
                        task_data = json.loads(message.body.decode())
                        print(f"Received task data: {task_data}")
                        # Process task here
                        await publish_message(TASK_SUGGESTION_QUEUE, {"status": "processed"})
                    except Exception as e:
                        print(f"Error processing message: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan, including the RabbitMQ consumer."""
    print("Starting RabbitMQ consumer...")
    # consumer_task = asyncio.create_task(start_consumer())
    consumer_task = asyncio.create_task(consume_messages())
    try:
        yield
    finally:
        print("Shutting down consumers...")
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
