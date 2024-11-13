import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { toast } from "sonner"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import TasksPanel from "./TasksPanel";
import CounterPanel from "./CounterPanel";
import { useSelectProjectTask } from "./hooks/use-select-projecttask";
import { useTaskTimer } from "./hooks/timer/useTaskTimer";
import { removeClientToken } from "../lib/auth";

interface MainProps {
  token: string
}

const Main: React.FC<MainProps> = ({
  token
}) => {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasTaskStorePermission, setHasTaskStorePermission] = useState(false);
  const toggleExpand = () => {
    setIsExpanded((prev) => !prev);
    window.electron.ipcRenderer.send('toggle-expand', isExpanded);
  };
  const { init_project_id, init_task_id } = useSelectProjectTask()

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
  } = useTaskTimer(init_task_id, init_project_id, pauseTask);

  useEffect(() => {
    if (isRunning && window.electron) {
      window.electron.ipcRenderer.send('timer-update', {
        project_id: init_project_id,
        selectedTaskId: init_task_id,
        hours,
        minutes,
        seconds
      });
    }
  }, [hours, minutes, seconds, isRunning, init_project_id, init_task_id]);

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

  useEffect(() => {
    const fetchData = async () => {


      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/init-system`, {
        method: 'GET',
        headers: {
          'Authorization': `${token}`,
        },
      });

      const { data } = await res.json();
      const permission = data.permission_routes.includes("task.store");
      setHasTaskStorePermission(permission);
    };

    if (token) {
      fetchData();
    }
  }, [token]);

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

  const handleTimerToggle = async () => {
    if (!isRunning) {
      start();
      await startTask(init_project_id, init_task_id);
    } else {
      pause();
      await pauseTask(init_project_id, init_task_id);
    }
  };

  return (
    <div className="flex flex-col w-full h-screen">
      <div className="flex justify-end mt-[10px]">
        <DropdownMenu>
          <DropdownMenuTrigger className="mb-10 p-0 cursor-pointer" asChild>
            <img src='/images/profile.svg' className="w-9 h-9 mx-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="bottom" align="end" className="w-56 bg-white">
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => {
                removeClientToken();
                localStorage.removeItem('user');
                localStorage.removeItem('taskTimers');
                router.push('/home')
              }}
            >
              <span>Sign Out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex w-full">
        <CounterPanel hours={hours} minutes={minutes} seconds={seconds} isRunning={isRunning} handleTimerToggle={handleTimerToggle} isExpanded={isExpanded} toggleExpand={toggleExpand} token={token} />
        {
          isExpanded && (
            <TasksPanel hasTaskStorePermission={hasTaskStorePermission} handleTimerToggle={handleTimerToggle} isExpanded={isExpanded} token={token} />
          )
        }
      </div>
    </div>
  );
};

export default Main;