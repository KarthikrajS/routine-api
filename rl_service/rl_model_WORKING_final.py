from datetime import datetime, timedelta
from stable_baselines3 import PPO
from stable_baselines3.common.env_util import make_vec_env
import numpy as np
from gymnasium import Env
from gymnasium.spaces import Discrete, Box

STATUS_MAP = {"completed": 1.0, "in_progress": 0.5, "pending": 0.0, "deferred": -0.5}

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
            low=np.array([0, 0, 0, 0, -1], dtype=np.float32),
            high=np.array([1, np.inf, np.inf, 1, 1], dtype=np.float32),
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
        #  return observation, reward, done,False, {}
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

        return np.array([status, time_left, priority, feedback_score, deadline_missed], dtype=np.float32)


    def _calculate_reward(self, task, action):
        if action == 1:  # Complete task
            return 2.0 if self._is_on_time(task) else 1.0
        else:  # Skip task
            return -0.5 if not self._is_deadline_missed(task) else -2.0

    def _is_on_time(self, task):
        planned_end = self._parse_date(task["dueDate"]["endDate"])
        completed_at = self._parse_date(task.get("completedAt", {}).get("date", None)) or self.current_time
        return completed_at <= planned_end

    def _is_deadline_missed(self, task):
        due_end = self._parse_date(task["dueDate"]["endDate"])
        return self.current_time > due_end

    def _time_to_deadline(self, task):
        due_end = self._parse_date(task["dueDate"]["endDate"])
        time_remaining = max(0, (due_end - self.current_time).total_seconds() / 3600)
        return time_remaining

    def _evaluate_feedback(self, feedback):
        # Simple scoring for feedback: valid text = positive, garbage = neutral
        if not feedback or feedback.strip() in {".", " "}:
            return 0.0
        return min(1.0, len(feedback.strip()) / 50)  # Normalize feedback length to a score

    @staticmethod
    def _parse_date(date_str):
        if not date_str:
            return datetime.min
        try:
            return datetime.strptime(date_str, "%Y-%m-%dT%H:%M:%S.%fZ")
        except ValueError:
            return datetime.min


def train_model(data):
    tasks = data.get("tasks", [])
    env = make_vec_env(lambda: TaskEnvironment(tasks), n_envs=1)
    model = PPO("MlpPolicy", env, verbose=1, tensorboard_log="./ppo_task_env/")
    model.learn(total_timesteps=5000)


def get_suggestions(data, period="day"):
    tasks = data.get("tasks", [])
    env = TaskEnvironment(tasks)
    suggestions = []

    for _ in range(len(tasks)):
        observation = env._get_observation()
        action, _ = model.predict(observation)
        suggestions.append(action)
        env.step(action)

    return suggestions
