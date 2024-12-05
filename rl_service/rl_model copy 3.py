from datetime import datetime, timedelta
from stable_baselines3 import PPO
import numpy as np
from gymnasium import Env
from gymnasium.spaces import Discrete, Box
from stable_baselines3.common.env_util import make_vec_env

# Status mapping for task completion
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
        self.observation_space = Box(
            low=np.array([0, 0, 0, 0, 0], dtype=np.float32),
            high=np.array([1, np.inf, np.inf, 1, 1], dtype=np.float32),
            dtype=np.float32,
        )


    def reset(self, seed=None, options=None):
        if seed is not None:
            self.seed_value = seed
            np.random.seed(seed)

        self.current_task = 0
        self.current_time = datetime.utcnow()  # Reset current time to the simulation start
        return self._get_observation(), {}


    def step(self, action):
        task = self.tasks[self.current_task]
        reward = 0.0

        # Reward logic
        if action == 1:  # Complete task
            if task["status"] == "completed":
                reward = 2.0 if self._is_on_time(task) else 1.0
            else:
                reward = -1.0
        else:  # Skip task
            reward = -0.5 if not self._is_deadline_missed(task) else -2.0

        # Update state
        self.current_time += timedelta(hours=1)
        self.current_task += 1

        done = self.current_task >= len(self.tasks)
        observation = self._get_observation()
        info = {}

        return observation, reward, done, info

    def _get_observation(self):
        if self.current_task >= len(self.tasks):
            return np.zeros(5, dtype=np.float32)  # No tasks left, reset observation space

        task = self.tasks[self.current_task]

        # Task status (0.0, 0.5, 1.0)
        status = STATUS_MAP.get(task["status"], 0)

        # Time left to deadline (calculated as time remaining in hours)
        time_left = self._time_to_deadline(task)

        # Task priority (default to 1 if missing)
        priority = task.get("priority", 1)

        # Task progress (based on status)
        progress = self._calculate_progress(task)

        # Deadline missed (1 if missed, 0 if not)
        deadline_missed = 1.0 if self._is_deadline_missed(task) else 0.0

        # Ensure the observation is always a 5-element array
        observation = np.array([status, time_left, priority, progress, deadline_missed], dtype=np.float32)
        print(f"Generated Observation (shape {observation.shape}): {observation}")
        return observation

    def _is_on_time(self, task):
        planned_end = self._parse_date(task["dueDate"]["endDate"])
        completed_at = self._parse_date(task["completedAt"]["date"]) if task["status"] == "completed" else self.current_time
        return completed_at <= planned_end

    def _is_deadline_missed(self, task):
        due_end = self._parse_date(task["dueDate"]["endDate"])
        return self.current_time > due_end

    def _time_to_deadline(self, task):
        due_end = self._parse_date(task["dueDate"]["endDate"])
        time_remaining = (due_end - self.current_time).total_seconds() / 3600  # Time left in hours
        return max(0, time_remaining)  # Ensure it never goes negative
  # Time left in hours

    def _calculate_progress(self, task):
        if "progress" in task:
            return task["progress"]
        return STATUS_MAP.get(task["status"], 0)


    @staticmethod
    def _parse_date(date_str):
        return datetime.strptime(date_str, "%Y-%m-%dT%H:%M:%S.%fZ") if date_str else datetime.min


# Training and Suggestion Functions
def train_model(data):
    global model
    tasks = data.get("tasks", [])
    if not tasks:
        raise ValueError("No tasks found in the data")

    env = TaskEnvironment(tasks)
    env = make_vec_env(lambda: env, n_envs=1)  # Use make_vec_env for simplicity
    obs = env.reset()
    print(f"Initial observation (shape {obs.shape}): {obs}")

    model = PPO("MlpPolicy", env, verbose=1, tensorboard_log="./ppo_task_env/")
    try:
        model.learn(total_timesteps=2048)
    except Exception as e:
        print(f"Training error: {e}")

def get_suggestions(data):
    global model
    if not model:
        raise ValueError("Model is not trained yet!")

    tasks = data.get("tasks", [])
    env = TaskEnvironment(tasks)
    suggestions = []

    for task in tasks:
        observation = env._get_observation()  # Get task observation
        action, _ = model.predict(observation)
        suggestions.append(action)

        env.step(action)  # Progress the environment with the chosen action

    return suggestions

