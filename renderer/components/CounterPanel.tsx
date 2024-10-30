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
    const requestBody = task_id === -1
      ? { project_id }
      : { project_id, task_id };
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/track/pause`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `${token}`
      },
      body: JSON.stringify(requestBody)
    });
    const { success } = await res.json();
    if (!success) {
      toast.error(`Track Pause Something went wrong ${project_id} ${task_id}`);
      return;
    }
    toast.success(`Task track paused : ${project_id} ${task_id}`);
  };

  const {
    seconds,
    minutes,
    hours,
    isRunning,
    start,
    pause,
  } = useTaskTimer(chosen_task_id, chosen_project_id, pauseTask);

  // Handle timer updates

  useEffect(() => {
    if (isRunning && window.electron) {
      window.electron.ipcRenderer.send('timer-update', {
        project_id: chosen_project_id,
        selectedTaskId: chosen_task_id,
        hours,
        minutes,
        seconds
      });
    }
  }, [hours, minutes, seconds, isRunning, chosen_project_id, chosen_task_id]);

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
    const requestBody = task_id === -1
      ? { project_id }
      : { project_id, task_id };
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/track/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `${token}`
      },
      body: JSON.stringify(requestBody)
    });
    const { success } = await res.json();

    if (!success) {
      toast.error(`Track Start : Something went wrong ${project_id} ${task_id}`);
      return;
    }
    toast.success(`Task track started : ${project_id} ${task_id}`);
  };

  const formatTime = (value: number) => {
    return value.toString().padStart(2, '0');
  };

  const handleTimerToggle = async () => {
    if (!isRunning) {
      start();
      await startTask(chosen_project_id, chosen_task_id);
    } else {
      pause();
      await pauseTask(chosen_project_id, chosen_task_id);
    }
  };

  return (
    <div className='flex flex-col gap-4 min-w-[458px] p-5 justify-between border-r'>
      {/* <div className="flex flex-col items-center gap-5">
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
      </div> */}
      <p className='text-xl leading-[25px] font-normal'>My Projects</p>
      <p className='text-base leading-5 font-normal bg-[#294DFF] h-9 py-2 text-center text-white'>
        {`${formatTime(hours)}:${formatTime(minutes)}:${formatTime(seconds)}`}
      </p>
      <div className="flex items-center justify-center">
        {
          !isRunning ? (
            <img src="/images/start.png" className={cn("w-[50px] h-[50px] cursor-pointer")} />
          ) : (
            <img src="/images/start.png" className={cn("w-[50px] h-[50px] cursor-pointer")} />
          )
        }
      </div>

      <form className="flex items-center w-full mx-auto">
        <div className="relative w-full">
          <div className="absolute inset-y-0 start-0 flex items-center ps-3">
            <img src="/images/search.png" className="h-[26px] w-[26px] cursor-pointer" />
          </div>
          <input type="text" className=" border block w-full ps-10 p-2.5" />
        </div>
      </form>

      <Project token={token} />

    </div>
  );
};

export default CounterPanel;