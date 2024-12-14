from datetime import datetime, timedelta
from stable_baselines3 import PPO
from stable_baselines3.common.env_util import make_vec_env
import numpy as np
from gymnasium import Env
from gymnasium.spaces import Discrete, Box

STATUS_MAP = {"completed": 1.0, "in_progress": 0.5, "pending": 0.0, "deferred": -0.5}
TASK_TYPE_MAP = {
    "Social": 0.2,
    "Personal Care": 0.4,
    "Meals": 0.6,
    "Transportation": 0.8,
    "Incidental": 1.0,
    "Coordinated": 1.2,
    "Planned": 1.4,
    "Household chores":1.6,
    "Leisure":1.8,
    "Exercise":2.2,
    "Work":2.0,
    "Miscellaneous":0.0
}
max_priority = 5
max_feedback = 1
max_task_type = 2.2
max_time=48

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
            low=np.array([0, 0, 0, 0, -1, 0], dtype=np.float32),
            high=np.array([1, np.inf, np.inf, 1, 1, 2.2], dtype=np.float32),  # Adjust the range for task_type
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
        status / 1.0,  # Binary feature
        time_left / max_time,  # Normalize `time_left`
        priority / max_priority,  # Normalize priority
        feedback_score / max_feedback,  # Normalize feedback
        deadline_missed / 1.0,  # Binary feature
        task_type / max_task_type  # Normalize `task_type`
    ], dtype=np.float32)
        print(f"Generated Observation (shape {observation.shape}): {observation}")
        return observation

    def _calculate_reward(self, task, action):
      task_type = TASK_TYPE_MAP.get(task.get("type", "Miscellaneous"), 0)
      time_left = task.get("time_left", 0)
      priority = task.get("priority", 1)
      if action == 1:  # Completing the task
          reward = 2.0 * priority + task_type - (1.0 / (1 + time_left))
      else:  # Skipping the task
          reward = -1.0 * priority - task_type - (1.0 / (1 + time_left))
      return reward


    # def _calculate_reward(self, task, action):
    # # If the task is already completed
    #   task_type = TASK_TYPE_MAP.get(task.get("type", "Miscellaneous"), 0)
    #   priority = task.get("priority", 1)
    #   if task["status"] == "completed":
    #       return 0.0

    #   if action == 1:  # Complete the task
    #       if self._is_on_time(task):
    #           return 2.0 + task.get("priority", 1)  # Bonus for priority tasks
    #       else:
    #           return 1.0
    #   else:  # Skip the task
    #       if self._is_deadline_missed(task):
    #           return -3.0  # Harsh penalty for skipping missed deadlines
    #       else:
    #           return -1.0 

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
    model.save("task_scheduler_model")  # Save the retrained model
    print("Model retrained and saved successfully!")



def get_suggestions(data, model_path="task_scheduler_model"):
    tasks = data.get("tasks", [])
    env = TaskEnvironment(tasks)
    model = PPO.load(model_path)  # Load the trained model
    suggestions = []

    for _ in range(len(tasks)):
        observation = env._get_observation()
        action, _ = model.predict(observation)
        suggestions.append(int(action))
        env.step(action)

    return suggestions
# def get_suggestions(data, model_path="task_scheduler_model"):
#     tasks = data.get("tasks", [])
#     env = TaskEnvironment(tasks)
#     model = PPO.load(model_path)  # Load the trained model
#     suggestions = []

#     for i in range(len(tasks)):
#         observation = env._get_observation()
#         action, _ = model.predict(observation)

#         # Post-prediction correction:
#         task = tasks[i]
#         if task["status"] == "completed":
#             suggestions.append(1)  # Automatically mark completed tasks
#         elif task["status"] in {"deferred", "pending"}:
#             suggestions.append(0)  # Skip deferred/pending tasks
#         else:
#             suggestions.append(int(action))

#         env.step(action)  # Proceed to the next task

#     return suggestions


# # Example usage:
# task_data = {"tasks":[
#   {
#     "dueDate": {
#       "startDate": "2024-12-20T19:15:45.916Z",
#       "endDate": "2024-12-20T19:15:45.916Z"
#     },
#     "actualStartAt": {
#       "date": "2024-12-07T00:00:00.000Z"
#     },
#     "completedAt": {
#       "date": "2024-12-07T00:00:00.000Z"
#     },
#     "assigntTo": {
#       "_id": "674761fdf2e05f89435a0338",
#       "username": "KJ"
#     },
#     "_id": "67534d671eb5ddc64f90fc7b",
#     "userId": "67534d555a54d85e55ba9779",
#     "title": "Qui dolorum sed comm",
#     "description": "Ad eligendi sit exe",
#     "priority": 1,
#     "status": "completed",
#     "__v": 0
#   },
#   {
#     "dueDate": {
#       "startDate": "2024-12-06T19:15:45.916Z",
#       "endDate": "2024-12-06T19:15:45.916Z"
#     },
#     "actualStartAt": {
#       "date": "2024-12-07T00:00:00.000Z"
#     },
#     "completedAt": {
#       "date": ""
#     },
#     "assigntTo": {
#       "_id": "674761fdf2e05f89435a0338",
#       "username": "KJ"
#     },
#     "_id": "67534d6e1eb5ddc64f90fc7d",
#     "userId": "67534d555a54d85e55ba9779",
#     "title": "Qui dolorum sed comm",
#     "description": "Ad eligendi sit exe",
#     "priority": 1,
#     "status": "in_progress",
#     "__v": 0
#   },
#   {
#     "dueDate": {
#       "startDate": "2024-12-06T19:15:45.916Z",
#       "endDate": "2024-12-06T19:15:45.916Z"
#     },
#     "actualStartAt": {
#       "date": "2024-12-07T00:00:00.000Z"
#     },
#     "completedAt": {
#       "date": ""
#     },
#     "assigntTo": {
#       "_id": "674761fdf2e05f89435a0338",
#       "username": "KJ"
#     },
#     "_id": "67534d751eb5ddc64f90fc7f",
#     "userId": "67534d555a54d85e55ba9779",
#     "title": "Mollit perspiciatis",
#     "description": "Sunt fugit est labo",
#     "priority": 1,
#     "status": "in_progress",
#     "__v": 0
#   },
#   {
#     "dueDate": {
#       "startDate": "2024-12-27T19:15:45.916Z",
#       "endDate": "2024-12-27T19:15:45.916Z"
#     },
#     "actualStartAt": {
#       "date": ""
#     },
#     "completedAt": {
#       "date": ""
#     },
#     "assigntTo": {
#       "_id": "674761fdf2e05f89435a0338",
#       "username": "KJ"
#     },
#     "_id": "67534d791eb5ddc64f90fc81",
#     "userId": "67534d555a54d85e55ba9779",
#     "title": "Mollit perspiciatis",
#     "description": "Sunt fugit est labo",
#     "priority": 1,
#     "status": "deferred",
#     "__v": 0,
#     "feedback": "Not going to do it"
#   },
#   {
#     "dueDate": {
#       "startDate": "2024-12-26T19:15:45.916Z",
#       "endDate": "2024-12-27T19:15:45.916Z"
#     },
#     "actualStartAt": {
#       "date": "2024-12-07T00:00:00.000Z"
#     },
#     "completedAt": {
#       "date": "2024-12-07T00:00:00.000Z"
#     },
#     "assigntTo": {
#       "_id": "674761fdf2e05f89435a0338",
#       "username": "KJ"
#     },
#     "_id": "67534d811eb5ddc64f90fc83",
#     "userId": "67534d555a54d85e55ba9779",
#     "title": "Magnam ratione omnis",
#     "description": "Sed fuga Ut blandit",
#     "priority": 1,
#     "status": "completed",
#     "taskType":"Personal care",
#     "__v": 0
#   },
#   {
#     "dueDate": {
#       "startDate": "2024-12-06T19:17:04.508Z",
#       "endDate": "2024-12-06T19:17:04.508Z"
#     },
#     "actualStartAt": {
#       "date": ""
#     },
#     "completedAt": {
#       "date": ""
#     },
#     "assigntTo": {
#       "_id": "674761fdf2e05f89435a0338",
#       "username": "KJ"
#     },
#     "_id": "67534dbc1eb5ddc64f90fc87",
#     "userId": "67534d555a54d85e55ba9779",
#     "title": "Mollitia commodo vol",
#     "description": "Illum ullamco ea do",
#     "priority": 1,
#     "status": "deferred",
#     "__v": 0,
#     "taskType":"Planned",
#     "feedback": "Too many tasks"
#   }
# ]

    
# }

# # Train the model
# train_model(task_data)

# # Get suggestions
# suggestions = get_suggestions(task_data)
# print("Suggested actions:", suggestions)
