import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query";

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
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasTaskStorePermission, setHasTaskStorePermission] = useState(false);
  const toggleExpand = () => {
    setIsExpanded((prev) => !prev);
    window.electron.ipcRenderer.send('toggle-expand', isExpanded);
  };
  const { init_project_id, init_task_id } = useSelectProjectTask()

  const pauseTask = async (project_id: number, task_id: number) => {
    try {
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
      const { success, message } = await res.json();
      console.log("pause", success, message)
      if (success) {
        toast.success(`Task track paused : ${project_id} ${task_id}`, {
          duration: 1000,
        });
        return true;
      } else {
        toast.error(`Track Pause Something went wrong ${project_id} ${task_id} ${message}`, {
          duration: 5000,
        });
        return false;
      }
    } catch (error) {
      toast.error(`Track Pause Something went wrong ${project_id} ${task_id} ${error}`, {
        duration: 5000,
      });
      return false;
    }
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
    // Listen for shutdown attempts
    const handleShutdownAttempt = async () => {
      if (isRunning) {
        // Show warning toast with actions
        toast.warning(
          "Task is still running! Please stop the task before shutting down.",
          {
            duration: Infinity,
            action: {
              label: "Stop Task & Shutdown",
              onClick: async () => {
                try {
                  // Attempt to pause the running task
                  const pauseSuccess = await pauseTask(init_project_id, init_task_id);
                  if (pauseSuccess) {
                    pause();
                    window.electron.ipcRenderer.send('idle-stopped', {
                      projectId: init_project_id,
                      taskId: init_task_id
                    });
                    // Allow shutdown
                    window.electron.ipcRenderer.send('shutdown-response', true);
                    // Force shutdown
                    window.electron.ipcRenderer.send('force-shutdown');
                  }
                } catch (error) {
                  console.error('Error stopping task during shutdown:', error);
                  toast.error('Failed to stop task. Please try again.');
                  window.electron.ipcRenderer.send('shutdown-response', false);
                }
              },
            },
          }
        );
      } else {
        // If no task is running, allow shutdown
        window.electron.ipcRenderer.send('shutdown-response', true);
      }
    };

    // Add shutdown attempt listener and store the cleanup function
    const cleanup = window.electron?.ipcRenderer.on('shutdown-attempted', handleShutdownAttempt);

    // Use the cleanup function returned by the 'on' method
    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [isRunning, init_project_id, init_task_id, pause, pauseTask]);


  useEffect(() => {
    if (isRunning && window.electron) {
      window.electron.ipcRenderer.send('timer-update', {
        project_id: init_project_id,
        selectedTaskId: init_task_id,
        isRunning,
        hours,
        minutes,
        seconds
      });
    }
  }, [hours, minutes, seconds, isRunning, init_project_id, init_task_id]);


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
    try {
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
      const { success, message } = await res.json();

      if (success) {
        toast.success(`Task track started : ${project_id} ${task_id}`, {
          duration: 1000,
        });
        return true;
      } else {
        toast.error(`Track Start : Something went wrong ${project_id} ${task_id} ${message}`, {
          duration: 5000,
        });
        return false;
      }
    } catch (error) {
      toast.error(`Track Start : Something went wrong ${project_id} ${task_id} ${error}`, {
        duration: 5000,
      });
      return false;
    }
  };


  const handleTimerToggle = async () => {
    if (!isRunning) {
      const startSuccess = await startTask(init_project_id, init_task_id);
      if (startSuccess) {
        start();
        console.log("idle key : ", init_project_id, init_task_id)
        window.electron.ipcRenderer.send('idle-started', { projectId: init_project_id, taskId: init_task_id });
      }
    } else {
      const pauseSuccess = await pauseTask(init_project_id, init_task_id);
      if (pauseSuccess) {
        pause();
        window.electron.ipcRenderer.send('idle-stopped', { projectId: init_project_id, taskId: init_task_id });
      }
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
                queryClient.clear()
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
            <TasksPanel hasTaskStorePermission={hasTaskStorePermission} isRunning={isRunning} handleTimerToggle={handleTimerToggle} isExpanded={isExpanded} token={token} pause={pause} />
          )
        }
      </div>
    </div>
  );
};

export default Main;