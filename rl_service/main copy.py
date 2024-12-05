from fastapi import FastAPI, HTTPException
from rl_model import train_model, get_suggestions
import pika
import json

app = FastAPI()

# @app.post("/train")
# def train(data: dict):
#     try:
#         train_model(data)
#         return {"message": "Model trained successfully"}
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))

# @app.post("/suggestions")
# def suggestions(data: dict):
#     try:
#         return {"suggestions": get_suggestions(data)}
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))
    
def callback(ch, method, properties, body):
    print(body, "body")
    task_data = json.loads(body)
    print(task_data, "task_data")
    print(f"Received task data: {task_data}")
    train_model(task_data)
    ch.basic_ack(delivery_tag=method.delivery_tag)

def main():
    connection = pika.BlockingConnection(pika.ConnectionParameters('amqp://localhost:5672'))
    print(connection, "connection")
    channel = connection.channel()
    channel.queue_declare(queue='taskQueue', durable=True)

    channel.basic_consume(queue='taskQueue', on_message_callback=callback)
    print('Waiting for messages...')
    channel.start_consuming()

if __name__ == "__main__":
    main()
