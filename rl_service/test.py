from stable_baselines3 import PPO
from stable_baselines3.common.env_util import make_vec_env

# Make vectorized environment
env = make_vec_env(lambda: TaskEnvironment(tasks), n_envs=1)

# Correctly handle reset output during training
obs, info = env.reset()  # Adjusted to unpack the reset output

# Train PPO model
model = PPO("MlpPolicy", env, verbose=1, tensorboard_log="./ppo_task_env/")
model.learn(total_timesteps=2048)
