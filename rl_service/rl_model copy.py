from stable_baselines3 import PPO
import numpy as np

model = None

def train_model(data):
    print(data, "Data")
    global model
    # Example training data: tasks, rewards, completion times
    states = np.array([d['status'] for d in data['tasks']])
    rewards = np.array([d['reward'] for d in data['tasks']])
    actions = np.random.choice([0, 1], size=len(states))  # Example actions
    
    # PPO model (or replace with desired RL algorithm)
    model = PPO("MlpPolicy", env=None, verbose=1)  # Replace `env` with your custom environment
    model.learn(total_timesteps=10000)  # Training

def get_suggestions(data):
    global model
    if not model:
        raise ValueError("Model is not trained yet!")
    
    states = np.array([d['state'] for d in data['tasks']])
    actions = model.predict(states)
    return actions.tolist()
