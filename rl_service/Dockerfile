# FROM python:3.9
# WORKDIR .
# COPY requirements.txt ./
# RUN pip install -r requirements.txt
# COPY . .
# EXPOSE 8003

# CMD ["python", "main.py"]


# Use an official Python slim image for smaller build size
# Use an official Python slim image for smaller build size
FROM python:3.9-slim

# Set the working directory inside the container
WORKDIR /app

# Copy and install Python dependencies
COPY rl_service/requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code to the container
COPY rl_service/ .

# Expose the service port (platform-specific port is used during runtime)
EXPOSE 8003

# Command to run the FastAPI app with Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "${PORT}"]
