# rl_model.py
from datetime import datetime, timedelta
from stable_baselines3 import PPO
from stable_baselines3.common.env_util import make_vec_env
import numpy as np
from gymnasium import Env
from gymnasium.spaces import Discrete, Box

# Constants
STATUS_MAP = {"completed": 1.0, "in_progress": 0.5, "pending": 0.0, "deferred": -0.5}
TASK_TYPE_MAP = {
    "Social": 0.2, "Personal Care": 0.4, "Meals": 0.6, "Transportation": 0.8, "Incidental": 1.0,
    "Coordinated": 1.2, "Planned": 1.4, "Household chores": 1.6, "Leisure": 1.8, "Exercise": 2.2,
    "Work": 2.0, "Miscellaneous": 0.0
}
max_priority = 5
max_feedback = 1
max_task_type = 2.2
max_time = 48

class TaskEnvironment(Env):
    def __init__(self, tasks):
        super(TaskEnvironment, self).__init__()
        self.tasks = tasks
        self.current_task = 0
        self.current_time = datetime.utcnow()
        self.action_space = Discrete(2)  # Actions: 0 = Skip, 1 = Complete
        self.observation_space = Box(
            low=np.array([0, 0, 0, 0, -1, 0], dtype=np.float32),
            high=np.array([1, np.inf, np.inf, 1, 1, 2.2], dtype=np.float32),
            dtype=np.float32,
        )

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        self.current_task = 0
        self.current_time = datetime.utcnow()
        return self._get_observation(), {}

    def step(self, action):
        if self.current_task >= len(self.tasks):
            return np.zeros(5, dtype=np.float32), 0.0, True, {}

        task = self.tasks[self.current_task]
        reward = self._calculate_reward(task, action)
        self.current_time += timedelta(hours=1)
        self.current_task += 1
        done = self.current_task >= len(self.tasks)
        return self._get_observation(), reward, done, False, {}

    def _get_observation(self):
        if not self.tasks or self.current_task >= len(self.tasks):
            return np.zeros(5, dtype=np.float32)

        task = self.tasks[self.current_task]
        status = STATUS_MAP.get(task["status"], 0)
        time_left = self._time_to_deadline(task)
        priority = task.get("priority", 1)
        feedback_score = self._evaluate_feedback(task.get("feedback", ""))
        deadline_missed = 1.0 if self._is_deadline_missed(task) else 0.0
        task_type = TASK_TYPE_MAP.get(task.get("taskType", "Miscellaneous"), 0)

        observation = np.array([
            status / 1.0,
            time_left / max_time,
            priority / max_priority,
            feedback_score / max_feedback,
            deadline_missed / 1.0,
            task_type / max_task_type
        ], dtype=np.float32)
        return observation

    def _calculate_reward(self, task, action):
        task_type = TASK_TYPE_MAP.get(task.get("taskType", "Miscellaneous"), 0)
        time_left = task.get("time_left", 0)
        priority = task.get("priority", 1)
        if action == 1:  # Completing the task
            reward = 2.0 * priority + task_type - (1.0 / (1 + time_left))
        else:  # Skipping the task
            reward = -1.0 * priority - task_type - (1.0 / (1 + time_left))
        return reward

    def _is_deadline_missed(self, task):
        due_end = self._parse_date(task["dueDate"]["endDate"])
        return self.current_time > due_end

    def _time_to_deadline(self, task):
        due_end = self._parse_date(task["dueDate"]["endDate"])
        time_remaining = max(0, (due_end - self.current_time).total_seconds() / 3600)
        return time_remaining

    def _evaluate_feedback(self, feedback):
        if not feedback or feedback.strip() in {".", " "}:
            return 0.0
        return min(1.0, len(feedback.strip()) / 50)

    @staticmethod
    def _parse_date(date_str):
        if not date_str:
            return datetime.min
        try:
            return datetime.strptime(date_str, "%Y-%m-%dT%H:%M:%S.%fZ")
        except ValueError:
            return datetime.min


def train_model(data):
    tasks = data if isinstance(data, list) else data.get("tasks", [])
    if not tasks:
        raise ValueError("No tasks provided for training.")
    
    env = make_vec_env(lambda: TaskEnvironment(tasks), n_envs=1)
    model = PPO("MlpPolicy", env, verbose=1, tensorboard_log="./ppo_task_env/")
    model.learn(total_timesteps=5000)
    model.save("ppo_task_model")


def get_suggestions(task_data):
    task_data = task_data if isinstance(task_data, list) else task_data.get("tasks", [])
    env = make_vec_env(lambda: TaskEnvironment(task_data), n_envs=1)
    model = PPO.load("ppo_task_model")
    suggestions = []
    for task in task_data:
        action = model.predict(env.reset())[0]
        suggestions.append(action)
    return suggestions


def get_weekly_suggestions(task_data):
    return {"suggestions": get_suggestions(task_data)}
