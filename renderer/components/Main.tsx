import { useEffect, useState } from "react";
import { useRouter } from "next/router";
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
import { removeClientToken } from "../lib/auth";
import { cn } from "../lib/utils";
import { useGetSyncTime } from "./hooks/timer/useGetSyncTime";
import Loader from "./Loader";
import { useGetInitSystem } from "./hooks/use-get-init-system";

interface MainProps {
  token: string
}

const Main: React.FC<MainProps> = ({
  token
}) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [time, setTime] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [isRunning, setIsRunning] = useState(false);
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);

  const [isExpanded, setIsExpanded] = useState(false);
  const [hasTaskStorePermission, setHasTaskStorePermission] = useState(false);
  const toggleExpand = () => {
    setIsExpanded((prev) => !prev);
    window.electron.ipcRenderer.send('toggle-expand', isExpanded);
  };
  const { init_project_id, init_task_id } = useSelectProjectTask()
  const { data, isLoading } = useGetSyncTime({ token })
  const { data: initData, isLoading: initLoading } = useGetInitSystem({ token });

  const start = () => {
    // Clear any existing time and interval when starting
    if (intervalId) {
      clearInterval(intervalId);
    }
    setTime({ hours: 0, minutes: 0, seconds: 0 });
    setIsRunning(true);

    const id = setInterval(() => {
      setTime(prevTime => {
        const newSeconds = prevTime.seconds + 1;
        const newMinutes = prevTime.minutes + Math.floor(newSeconds / 60);
        const newHours = prevTime.hours + Math.floor(newMinutes / 60);

        return {
          hours: newHours,
          minutes: newMinutes % 60,
          seconds: newSeconds % 60
        };
      });
    }, 1000);
    setIntervalId(id);
  };

  const pause = () => {
    if (isRunning && intervalId) {
      clearInterval(intervalId);
      setIsRunning(false);
    }
  };

  useEffect(() => {
    if (isRunning && window.electron) {
      window.electron.ipcRenderer.send('timer-update', {
        project_id: init_project_id,
        selectedTaskId: init_task_id,
        isRunning,
        hours: time.hours,
        minutes: time.minutes,
        seconds: time.seconds
      });
    }
  }, [time.hours, time.minutes, time.seconds, isRunning, init_project_id, init_task_id]);

  

  useEffect(() => {
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [intervalId]);

  useEffect(() => {
    console.log("init data : ", initData);
  
    if (initData) {
      if (!initData.success) {
        removeClientToken();
        localStorage.removeItem('user');
        queryClient.clear();
        router.push('/home');
      } else {
        const permission = initData.data.permission_routes.includes("task.store");
        setHasTaskStorePermission(permission);
      }
    }
  }, [initData]);

  const handleTimerToggle = async () => {
    if (!isRunning) {
      window.electron.ipcRenderer.send('permission-check');
      start()

      window.electron.ipcRenderer.send('idle-started', { projectId: init_project_id, taskId: init_task_id });
    } else {
      pause();
      window.electron.ipcRenderer.send('idle-stopped', { projectId: init_project_id, taskId: init_task_id });
      setTimeout(() => {
        handleSync();
      }, 5000);  
    }
  };

  const handleSync = () => {
    queryClient.invalidateQueries({ queryKey: ["sync_time"] });
    console.log("sync time : ", data)
  };

  if (isLoading || initLoading) {
    return (
      <Loader />
    )
  }


  return (
    <div className="flex flex-col justify-between w-full h-screen">
      <div className="flex flex-col gap-2">
        <div className="flex justify-between mt-[10px] px-5">
          <div className="flex items-center gap-2 border border-blue-400 rounded-md p-2">
            <div className="flex flex-col">
              <div className="flex justify-between items-center gap-10">
                <span className="font-bold text-emerald-500">Today</span>
                <button
                  onClick={handleSync}
                  disabled={isRunning}
                  className={cn("flex items-center h-4 text-blue-500 gap-2", isRunning && "cursor-not-allowed opacity-20")}
                >
                  <IoSync />
                  <p>Sync</p>
                </button>
              </div>
              <span>{data ? data.duration : '00:00:00'}</span>
            </div>
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
          <CounterPanel hours={time.hours} minutes={time.minutes} seconds={time.seconds} isRunning={isRunning} handleTimerToggle={handleTimerToggle} isExpanded={isExpanded} toggleExpand={toggleExpand} token={token} />
          {
            isExpanded && (
              <TasksPanel hasTaskStorePermission={hasTaskStorePermission} isRunning={isRunning} handleTimerToggle={handleTimerToggle} isExpanded={isExpanded} token={token} pause={pause} />
            )
          }
        </div>
      </div>
      <div className="px-5 border-t">
        <p>v1.0.4</p>
      </div>
    </div>
  );
};

export default Main;