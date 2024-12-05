import os
import matplotlib.pyplot as plt
import pandas as pd

# Define the path to the log directory
log_dir = '/ppo_task_env/'

# Check the directory contents
log_files = [f for f in os.listdir(log_dir) if f.startswith('PPO') and f.endswith('.monitor.csv')]

# If there are no log files found, return a message
if not log_files:
    print("No log files found in the specified directory.")
else:
    # Read and plot logs
    plt.figure(figsize=(10, 6))
    
    # Loop through all log files to read and plot the data
    for log_file in log_files:
        log_path = os.path.join(log_dir, log_file)
        data = pd.read_csv(log_path)
        
        # Plot reward over time
        plt.plot(data['total_timesteps'], data['episode_reward'], label=log_file)
    
    plt.xlabel('Total Timesteps')
    plt.ylabel('Episode Reward')
    plt.title('Reward vs Timesteps in PPO Training')
    plt.legend()
    plt.grid(True)
    plt.show()