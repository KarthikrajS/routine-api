# FROM python:3.9
# WORKDIR /app
# COPY requirements.txt ./
# RUN pip install -r requirements.txt
# COPY . .
# EXPOSE 8003

# CMD ["python", "main.py"]


# Use an official Python base image
FROM python:3.9

# Set the working directory inside the container
WORKDIR /app

# Copy the requirements file to the working directory
COPY COPY rl-service/requirements.txt ./

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire application code to the container
COPY . .

# Expose the service port (ensure it matches the one in your app)
EXPOSE 8003

# Command to run the FastAPI app with Uvicorn
CMD ["uvicorn", "main:app", "--reload", "--host", "0.0.0.0", "--port", "8003"]
