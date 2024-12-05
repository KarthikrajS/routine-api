from datetime import datetime, timedelta
from stable_baselines3 import PPO
import numpy as np
from gymnasium import Env
from gymnasium.spaces import Discrete, Box

STATUS_MAP = {
    "completed": 1.0,
    "in_progress": 0.5,
    "not_started": 0.0,
}

class TaskEnvironment(Env):
    def __init__(self, tasks):
        super(TaskEnvironment, self).__init__()
        self.tasks = tasks
        self.current_task = 0
        self.current_time = datetime.utcnow()  # Initialize current time as the start time of the simulation

        # Define action and observation spaces
        self.action_space = Discrete(2)  # Actions: 0 = Skip, 1 = Complete
        self.observation_space = Box(low=0, high=1, shape=(1,), dtype=np.float32)  # Task status

    def reset(self, seed=None, options=None):
        # Handle seed for reproducibility
        if seed is not None:
            self.seed_value = seed
            np.random.seed(seed)

        self.current_task = 0
        return self._get_observation(), {}
    
    def step(self, action):
        task = self.tasks[self.current_task]
        reward = 0.0

        # Reward logic based on action
        if action == 1:  # Complete task
            if task["status"] == "completed":
                reward = 2.0 if self._is_on_time(task) else 1.0
            else:
                reward = -1.0
        else:  # Skip task
            reward = -0.5 if not self._is_deadline_missed(task) else -2.0

        # Update current time and task pointer
        self.current_time += timedelta(hours=1)  # Increment time by 1 hour (can be adjusted)
        self.current_task += 1

        done = self.current_task >= len(self.tasks)  # Check if all tasks are processed
        return self._get_observation(), reward, done, {}

    def _get_observation(self):
        if self.current_task >= len(self.tasks):
            return np.array([0], dtype=np.float32)  # No tasks left
        task = self.tasks[self.current_task]
        return np.array([STATUS_MAP.get(task["status"], 0)], dtype=np.float32)

    def _is_on_time(self, task):
        planned_end = self._parse_date(task["dueDate"]["endDate"])
        completed_at = self._parse_date(task["completedAt"]["date"])
        return completed_at <= planned_end

    def _is_deadline_missed(self, task):
        due_end = self._parse_date(task["dueDate"]["endDate"])
        return self.current_time > due_end

    @staticmethod
    def _parse_date(date_str):
        return datetime.strptime(date_str, "%Y-%m-%dT%H:%M:%S.%fZ")

# Training and Suggestion Functions
def train_model(data):
    global model
    tasks = data.get("tasks", [])
    if not tasks:
        raise ValueError("No tasks found in the data")

    env = TaskEnvironment(tasks)
    model = PPO("MlpPolicy", env, verbose=1, tensorboard_log="./ppo_task_env/")

    model.learn(total_timesteps=2048)

def get_suggestions(data):
    global model
    if not model:
        raise ValueError("Model is not trained yet!")

    tasks = data.get("tasks", [])
    env = TaskEnvironment(tasks)
    observations = np.array([STATUS_MAP.get(task["status"], 0) for task in tasks])
    actions, _ = model.predict(observations)
    return actions.tolist()
