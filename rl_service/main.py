
# RabbitMQ Connection Parameters
from fastapi import FastAPI, HTTPException
from contextlib import asynccontextmanager
from rl_model import train_model, get_suggestions, get_weekly_suggestions
import json
import os
import asyncio
from aio_pika import connect_robust, Message
from typing import List, Dict, Any

# RabbitMQ Connection Parameters
RABBITMQ_URL = os.getenv("RABBITMQ_URL","amqps://aedzelrz:WyaTGqjpwTkTlac4KeY6l4qCcCIvobca@campbell.lmq.cloudamqp.com/aedzelrz")

# RABBITMQ_URL ="amqp://guest:guest@rabbitmq:5672"
TASK_QUEUE = "taskQueue"
TASK_LIST_QUEUE = "task_list"
TASK_SUGGESTION_QUEUE = "task_suggestion_queue"

# In-memory storage for daily task data and feedback
daily_task_data = []


async def connect_rabbitmq():
    """Establish a robust RabbitMQ connection."""
    return await connect_robust(RABBITMQ_URL)


async def publish_message(queue_name: str, message: dict):
    """Publish a message to a RabbitMQ queue."""
    connection = await connect_rabbitmq()
    async with connection:
        channel = await connection.channel()
        await channel.default_exchange.publish(
            Message(body=json.dumps(message).encode()),
            routing_key=queue_name,
        )
        print(f"Message published to {queue_name}: {message}")


async def process_task_queue_message(body: bytes):
    """Process messages from the taskQueue to train the RL model."""
    global daily_task_data
    try:
        task = json.loads(body.decode())
        print(f"Processing taskQueue message: {task}")

        # Append the task to the in-memory storage
        daily_task_data.append(task)

        # Train the RL model with the updated task data
        train_model(daily_task_data)
    except Exception as e:
        print(f"Error processing taskQueue message: {e}")


async def process_task_list_message(body: bytes):
    """Process messages from task_list to evaluate and suggest important tasks."""
    try:
        print(f"Received task list message: {body.decode()}")
        task_list = json.loads(body.decode())

        # Validate task list structure
        if not isinstance(task_list.get("tasks"), list):
            print("Malformed task list. Skipping.")
            return

        tasks: List[Dict[str, Any]] = task_list["tasks"]
        user_id = str(task_list.get("userId"))

        if not tasks or not user_id:
            print("Invalid task list data. Skipping.")
            return

        # Evaluate tasks using the RL model
        suggestions = get_suggestions(tasks)
        print(f"Suggestions for user {user_id}: {suggestions}")

        # Publish suggestions to task_suggestion_queue
        suggestion_message = {"userId": user_id, "suggestions": suggestions}
        await publish_message(TASK_SUGGESTION_QUEUE, suggestion_message)
    except Exception as e:
        print(f"Error processing task_list message: {e}")


async def consume_queue(queue_name: str, processor):
    """Consume messages from a specific RabbitMQ queue."""
    connection = await connect_rabbitmq()
    async with connection:
        channel = await connection.channel()
        queue = await channel.declare_queue(queue_name, durable=True)

        async with queue.iterator() as queue_iter:
            async for message in queue_iter:
                async with message.process():
                    try:
                        await processor(message.body)
                    except Exception as e:
                        print(f"Error processing message from {queue_name}: {e}")


async def start_consumer():
    """Start the RabbitMQ consumer for all relevant queues."""
    await asyncio.gather(
        consume_queue(TASK_QUEUE, process_task_queue_message),
        consume_queue(TASK_LIST_QUEUE, process_task_list_message),
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan, including the RabbitMQ consumer."""
    print("Starting RabbitMQ consumers...")
    consumer_task = asyncio.create_task(start_consumer())
    try:
        yield
    finally:
        print("Shutting down RabbitMQ consumers...")
        consumer_task.cancel()
        try:
            await consumer_task
        except asyncio.CancelledError:
            print("Consumer task cancelled.")


app = FastAPI(lifespan=lifespan)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok"}


@app.get("/suggestions/{period}")
async def get_analysis_suggestions(period: str):
    """Endpoint to get suggestions for tasks."""
    global daily_task_data

    try:
        if period not in {"day", "week"}:
            raise HTTPException(status_code=400, detail="Invalid period. Use 'day' or 'week'.")

        if period == "day":
            suggestions = get_suggestions(daily_task_data)
        else:
            suggestions = get_weekly_suggestions(daily_task_data)

        return {"period": period, "suggestions": suggestions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating suggestions: {e}")

