from datetime import datetime, timedelta

from stable_baselines3 import PPO
from stable_baselines3.common.env_util import make_vec_env
import numpy as np
from gymnasium import Env
from gymnasium.spaces import Discrete, Box


STATUS_MAP = {"completed": 1.0, "in_progress": 0.5, "not_started": 0.0}

class TaskEnvironment(Env):
    def __init__(self, tasks):
        super(TaskEnvironment, self).__init__()
        for task in tasks:
            if "status" not in task or "dueDate" not in task or "endDate" not in task["dueDate"]:
                raise ValueError(f"Invalid task data: {task}")
        self.tasks = tasks
        self.current_task = 0
        self.current_time = datetime.utcnow()

        self.action_space = Discrete(2)  # Actions: 0 = Skip, 1 = Complete
        self.observation_space = Box(
            low=np.array([0, 0, 0, 0, 0], dtype=np.float32),
            high=np.array([1, np.inf, np.inf, 1, 1], dtype=np.float32),
            dtype=np.float32,
        )

    def reset(self, seed=None, options=None):
        # if seed is not None:
        #     np.random.seed(seed)
        # self.current_task = 0
        # self.current_time = datetime.utcnow()
        # observation = self._get_observation()
        # print(f"Reset observation: {observation}")
        # assert observation.shape == (5,), f"Reset observation shape mismatch: {observation.shape}"
        # return observation, {}
        super().reset(seed=seed)
        self.current_task = 0
        self.current_time = datetime.utcnow()
        observation = self._get_observation()
        return observation, {}



    def step(self, action):
        if self.current_task >= len(self.tasks):
            observation = np.zeros(5, dtype=np.float32).reshape(1, -1)  # Return default observation with correct shape
            return observation, 0.0, True, {}

        task = self.tasks[self.current_task]
        reward = 0.0

        if action == 1:  # Complete task
            reward = 2.0 if self._is_on_time(task) else 1.0
        else:  # Skip task
            reward = -0.5 if not self._is_deadline_missed(task) else -2.0

        self.current_time += timedelta(hours=1)
        self.current_task += 1

        done = self.current_task >= len(self.tasks)
        observation = self._get_observation()
        reward = float(reward)  # Ensure reward is a scalar float
        done = bool(done)  # Ensure done is a boolean

        return observation, reward, done,False, {}


    
    def _get_observation(self):
        if not self.tasks or self.current_task >= len(self.tasks):
            return np.zeros(5, dtype=np.float32).reshape(1, -1)
        
        task = self.tasks[self.current_task]
        status = STATUS_MAP.get(task["status"], 0)
        time_left = self._time_to_deadline(task)
        priority = task.get("priority", 1)
        progress = self._calculate_progress(task)
        deadline_missed = 1.0 if self._is_deadline_missed(task) else 0.0

        return np.array([status, time_left, priority, progress, deadline_missed], dtype=np.float32).reshape(1, -1)



    def _is_on_time(self, task):
        planned_end = self._parse_date(task["dueDate"]["endDate"])
        completed_at = self._parse_date(task["completedAt"]["date"]) if task["status"] == "completed" else self.current_time
        return completed_at <= planned_end

    def _is_deadline_missed(self, task):
        due_end = self._parse_date(task["dueDate"]["endDate"])
        return self.current_time > due_end

    def _time_to_deadline(self, task):
        due_end = self._parse_date(task["dueDate"]["endDate"])
        time_remaining = max(0, (due_end - self.current_time).total_seconds() / 3600)
        return time_remaining



    def _calculate_progress(self, task):
        return task.get("progress", STATUS_MAP.get(task["status"], 0))

    
    @staticmethod
    def _parse_date(date_str):
        if not date_str:
            return datetime.min  # Default for missing dates
        try:
            return datetime.strptime(date_str, "%Y-%m-%dT%H:%M:%S.%fZ")
        except ValueError:
            print(f"Invalid date format: {date_str}")
            return datetime.min



def train_model(data):
    tasks = [task for task in data.get("tasks", []) if "status" in task and "dueDate" in task]
    if not tasks:
        raise ValueError("No valid tasks to train on")
    
    # Create the environment directly or use make_vec_env
    env = make_vec_env(lambda: TaskEnvironment(tasks), n_envs=1)
    
    # Reset environment
    try:
        obs = env.reset()
        print(f"Initial observation: {obs}")
        model = PPO("MlpPolicy", env, verbose=1, tensorboard_log="./ppo_task_env/")
        model.learn(total_timesteps=10000)
    except Exception as e:
        print(f"Training error: {e}")
        print(f"Observation shape: {obs.shape}")


    # Initialize PPO model
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

    for _ in range(len(tasks)):
        observation = env._get_observation()
        observation = observation.reshape(1, -1)  # Reshape for batch compatibility
        action, _ = model.predict(observation)
        suggestions.append(action)
        env.step(action)

    return suggestions

