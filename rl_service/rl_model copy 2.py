from stable_baselines3 import PPO
import numpy as np
from gym import Env
from gym.spaces import Discrete, Box

model = None

# Map status to numerical values
STATUS_MAP = {
    "completed": 1.0,
    "in-progress": 0.5,
    "not-started": 0.0
}

# Custom Gym environment
class TaskEnvironment(Env):
    def __init__(self, tasks):
        super(TaskEnvironment, self).__init__()
        self.tasks = tasks
        self.current_task = 0
        
        # Define action and observation space
        self.action_space = Discrete(2)  # Actions: 0 = Skip, 1 = Complete
        self.observation_space = Box(low=0, high=1, shape=(1,), dtype=np.float32)  # Priority normalized

    def reset(self):
        self.current_task = 0
        return self._get_observation()

    # def step(self, action):
    #     task = self.tasks[self.current_task]

    #     # Reward logic based on action
    #     if action == 1:  # Complete task
    #         reward = 1.0 if task["status"] == "completed" else -1.0
    #     else:  # Skip task
    #         reward = -0.5

    #     self.current_task += 1
    #     done = self.current_task >= len(self.tasks)
    #     return self._get_observation(), reward, done, {}

    def step(self, action):
        task = self.tasks[self.current_task]
        reward = 0.0

        if action == 1:  # Attempt to complete the task
            if task["status"] == "completed":
                reward = 1.0 if self._is_on_time(task) else 0.5
            else:
                reward = -0.5
        else:  # Skip the task
            reward = -1.0 if self._is_deadline_missed(task) else -0.5

        self.current_task += 1
        done = self.current_task >= len(self.tasks)
        return self._get_observation(), reward, done, {}

    def _is_on_time(self, task):
        """Checks if the task was completed on or before the planned end time."""
        planned_end = self._parse_date(task["dueDate"]["endDate"])
        completed_at = self._parse_date(task["completedAt"]["date"])
        return completed_at <= planned_end

    def _is_deadline_missed(self, task):
        """Checks if the deadline was missed."""
        due_end = self._parse_date(task["dueDate"]["endDate"])
        return self.current_time > due_end

    def _parse_date(self, date_str):
        from datetime import datetime
        return datetime.strptime(date_str, "%Y-%m-%dT%H:%M:%S.%fZ")
    
    def _get_observation(self):
        if self.current_task >= len(self.tasks):
            return np.array([0], dtype=np.float32)  # No tasks left
        task = self.tasks[self.current_task]
        return np.array([STATUS_MAP.get(task["status"], 0)], dtype=np.float32)

def train_model(data):
    global model
    tasks = data.get("tasks", [])
    if not tasks:
        raise ValueError("No tasks found in the data")

    # Initialize environment with tasks
    env = TaskEnvironment(tasks)

    # Train PPO model
    model = PPO("MlpPolicy", env, verbose=1)
    model.learn(total_timesteps=1000)

def get_suggestions(data):
    global model
    if not model:
        raise ValueError("Model is not trained yet!")
    
    tasks = data.get("tasks", [])
    env = TaskEnvironment(tasks)
    observations = np.array([STATUS_MAP.get(task["status"], 0) for task in tasks])
    actions, _ = model.predict(observations)
    return actions.tolist()
