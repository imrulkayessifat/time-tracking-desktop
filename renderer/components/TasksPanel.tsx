import { useEffect } from "react";
import { toast } from "sonner"

import Task from "./Task";
import { cn } from "../lib/utils";
import { useTaskTimer } from "./hooks/timer/useTaskTimer";
import { useSelectTask } from "./hooks/task/use-select-task";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface TasksPanelProps {
  token: string
}

const TasksPanel: React.FC<TasksPanelProps> = ({
  token
}) => {

  const { chosen_project_id, chosen_task_id } = useSelectTask()

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
      toast.error(`Track Pause Something went wrong ${project_id} ${task_id}`, {
        duration: 1000,
      });
      return;
    }
    toast.success(`Task track paused : ${project_id} ${task_id}`, {
      duration: 1000,
    });
  };

  const {
    seconds,
    minutes,
    hours,
    isRunning,
    start,
    pause,
  } = useTaskTimer(chosen_task_id, chosen_project_id, pauseTask);

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
    if (chosen_task_id !== -1) {
      toast.warning(`You need to start Task :  ${chosen_project_id}_${chosen_task_id}`, {
        duration: 1000,
      })
    }
  }, [chosen_task_id])

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
      toast.error(`Track Start : Something went wrong ${project_id} ${task_id}`, {
        duration: 1000,
      });
      return;
    }
    toast.success(`Task track started : ${project_id} ${task_id}`, {
      duration: 1000,
    });
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
    <div className='flex flex-col min-w-1/2 w-1/2 p-5 gap-4'>
      <div className="flex flex-col gap-8">
        <p className='text-xl leading-[25px] font-normal'>Tasks</p>
        <p className='text-base leading-5 font-normal bg-[#294DFF] h-9 py-2 text-center text-white'>
          {`${formatTime(hours)}:${formatTime(minutes)}:${formatTime(seconds)}`}
        </p>
        <div className="flex items-center justify-center">
          <button
            onClick={handleTimerToggle}
            disabled={chosen_task_id === -1}
          >
            {
              !isRunning ? (
                <img src={`${chosen_task_id !== -1 ? '/images/start.png' : '/images/disable.png'}`} className={cn("w-[50px] h-[50px] cursor-pointer", chosen_task_id === -1 && 'cursor-not-allowed')} />
              ) : (
                <img src="/images/pause.png" className={cn("w-[50px] h-[50px] cursor-pointer")} />
              )
            }
          </button>
        </div>
        <div className="flex w-full gap-2">
          <form className="flex items-center w-2/3">
            <div className="relative w-full">
              <div className="absolute inset-y-0 start-0 flex items-center ps-3">
                <img src="/images/search.png" className="h-[26px] w-[26px] cursor-pointer" />
              </div>
              <input type="text" className=" border block w-full ps-10 p-2.5" />
            </div>
          </form>
          <form className="flex items-center w-1/3">
            <Select defaultValue="to-do">
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="to-do">To Do</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </form>
        </div>
      </div>
      <Task token={token} />
    </div>
  )
}

export default TasksPanel