import { useStopwatch } from "react-timer-hook";
import { toast } from "sonner"
import { FaCirclePlay, FaCirclePause } from "react-icons/fa6";
import { useEffect } from "react";

import Project from "./Project";
import { cn } from '../lib/utils';
import { Separator } from "./ui/separator";
import { useTaskTimer } from "./hooks/timer/useTaskTimer";
import { useSelectTask } from "./hooks/task/use-select-task";
import { useSelectProject } from "./hooks/project/use-select-project";
import { useSelectProjectTask } from "./hooks/task/use-select-ProjectTask";

interface CounterPanelProps {
  token: string
}

const CounterPanel: React.FC<CounterPanelProps> = ({ token }) => {
  const { id: onlyProjectId } = useSelectProject();
  const { chosen_project_id, chosen_task_id } = useSelectProjectTask()
  const { id: selectedTaskId, project_id: selectedProjectId } = useSelectTask();

  console.log(chosen_project_id, chosen_task_id)

  const pauseTask = async (project_id: number, task_id: number) => {
    window.electron.ipcRenderer.send('idle-stopped', { projectId: project_id, taskId: task_id });
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/track/pause`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `${token}`
      },
      body: JSON.stringify({
        project_id,
        task_id,
      })
    });
    const { success } = await res.json();
    if (!success) {
      toast.error(`Track Pause Something went wrong ${project_id} ${task_id}`);
      return;
    }
    toast.success(`Task track paused : ${task_id}`);
  };

  const {
    seconds,
    minutes,
    hours,
    isRunning,
    start,
    pause,
  } = useTaskTimer(selectedTaskId, selectedProjectId, pauseTask);

  // Handle timer updates

  useEffect(() => {
    if (isRunning && window.electron) {
      window.electron.ipcRenderer.send('timer-update', {
        project_id: selectedProjectId,
        selectedTaskId,
        hours,
        minutes,
        seconds
      });
    }
  }, [hours, minutes, seconds, isRunning, selectedProjectId, selectedTaskId]);

  useEffect(() => {
    if (selectedTaskId !== -1) {
      toast.warning(`You need to start task ${selectedTaskId}`)
    }
  }, [selectedTaskId])

  useEffect(() => {
    if (onlyProjectId !== -1) {
      toast.warning(`You need to start Project ${onlyProjectId}`)
    }
  }, [onlyProjectId])

  // Effect for electron IPC communication
  useEffect(() => {
    if (!window.electron) return;

    const handleToggleTimer = () => {
      if (isRunning) {
        pause();
      } else {
        start();
      }
      window.electron.ipcRenderer.send('ds', !isRunning);
    };

    const unsubscribe = window.electron.ipcRenderer.on('toggle-timer', handleToggleTimer);
    return unsubscribe;
  }, [isRunning, pause, start]);

  const startTask = async (project_id: number, task_id: number) => {
    window.electron.ipcRenderer.send('idle-started', { project_id, task_id });
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/track/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `${token}`
      },
      body: JSON.stringify({
        project_id,
        task_id
      })
    });
    const { success } = await res.json();

    if (!success) {
      toast.error(`Track Start : Something went wrong ${project_id} ${task_id}`);
      return;
    }
    toast.success(`Task track started : ${task_id}`);
  };

  const formatTime = (value: number) => {
    return value.toString().padStart(2, '0');
  };

  const handleTimerToggle = async () => {
    if (!isRunning) {
      start();
      await startTask(selectedProjectId, selectedTaskId);
    } else {
      pause();
      await pauseTask(selectedProjectId, selectedTaskId);
    }
    if (window.electron) {
      window.electron.ipcRenderer.send('timer-status-update', !isRunning);
    }
  };

  return (
    <div className="w-full">
      <div className="flex flex-col items-center gap-5">
        <div className="flex justify-center">
          <p className="bg-gray-400 text-white mt-5 font-bold text-2xl px-28">
            {`${formatTime(hours)}:${formatTime(minutes)}:${formatTime(seconds)}`}
          </p>
        </div>
        <div className="flex justify-center">
          <button
            disabled={chosen_project_id === -1}
            onClick={handleTimerToggle}
          >
            {!isRunning ? (
              <FaCirclePlay
                className={cn(
                  "w-12 h-12 text-blue-500 cursor-pointer",
                  (chosen_project_id === -1) && "text-gray-300 cursor-not-allowed"
                )}
              />
            ) : (
              <FaCirclePause
                className={cn(
                  "w-12 h-12 text-blue-500 cursor-pointer",
                  (chosen_project_id === -1) && "text-gray-300 cursor-not-allowed"
                )}
              />
            )}
          </button>
        </div>
        <Separator className="bg-gray-300 w-11/12" />
        <div className="w-full px-5">
          <Project token={token} />
        </div>
      </div>
    </div>
  );
};

export default CounterPanel;