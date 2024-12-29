import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query";
import { IoSync } from "react-icons/io5";

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
import { cn } from "../lib/utils";
import { useGetSyncTime } from "./hooks/timer/useGetSyncTime";
import Loader from "./Loader";

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
  const { data, isLoading } = useGetSyncTime({ token })

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
      const { success, message, data } = await res.json();
      console.log("pause task : ", success, message, data)
      console.log("task key : ", project_id, task_id)
      if (success) {
        return {
          success,
          message,
          data
        }
      } else {
        return {
          success,
          message,
          data
        }
      }
    } catch (error) {
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
      console.log("init : ", res.status, typeof res.status)

      if (res.status === 401) {
        removeClientToken();
        localStorage.removeItem('user');
        // localStorage.removeItem('taskTimers');
        queryClient.clear()
        router.push('/home')
      }

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
      const { success, message, data } = await res.json();
      console.log("start task : ", success, message, data)
      console.log("task key : ", project_id, task_id)
      if (success) {
        return {
          success,
          message,
          data
        };
      } else {
        return {
          success: false,
          message,
          data
        };
      }
    } catch (error) {
      return false;
    }
  };


  const handleTimerToggle = async () => {
    if (!isRunning) {
      window.electron.ipcRenderer.send('permission-check');
      // const result = await startTask(init_project_id, init_task_id);


      start()
      window.electron.ipcRenderer.send('idle-started', { projectId: init_project_id, taskId: init_task_id });
    } else {
      // const pauseSuccess = await pauseTask(init_project_id, init_task_id);
      pause();
      window.electron.ipcRenderer.send('idle-stopped', { projectId: init_project_id, taskId: init_task_id });
    }
  };

  const handleSync = () => {
    queryClient.invalidateQueries({ queryKey: ["sync_time"] });
    console.log("sync time : ", data)
  };

  if (isLoading) {
    return (
      <Loader />
    )
  }



  return (
    <div className="flex flex-col w-full h-screen">
      <div className="flex justify-between mt-[10px] px-5">
        <div className="flex gap-2">
          <span className="font-bold">Today : {data.duration}</span>
          <button
            onClick={handleSync}
            disabled={isRunning}
            className={cn("flex items-center h-4 text-blue-500 gap-2", isRunning && "cursor-not-allowed opacity-20")}
          >
            <IoSync />
            <p>Sync</p>
          </button>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className="mb-10 p-0 cursor-pointer" asChild>
            <img src='/images/profile.svg' className="w-9" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="bottom" align="end" className="w-56 bg-white">
            <DropdownMenuItem
              disabled={isRunning}
              className={cn("cursor-pointer", isRunning && "cursor-not-allowed")}
              onClick={() => {
                removeClientToken();
                localStorage.removeItem('user');
                // localStorage.removeItem('taskTimers');
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
    </div >
  );
};

export default Main;