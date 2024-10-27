import {
  useState,
  useEffect
} from "react";
import { toast } from "sonner"
import { FaCirclePlay, FaCirclePause } from "react-icons/fa6";

import Project from "./Project";
import { cn } from '../lib/utils';
import { Separator } from "./ui/separator";
import { useSelectTask } from "./hooks/task/use-select-task";

interface TimeState {
  hours: number;
  minutes: number;
  seconds: number;
}

interface TaskTimer {
  projectId: number;
  taskId: number;
  time: TimeState;
}

interface CounterPanelProps {
  token: string;
}

const CounterPanel: React.FC<CounterPanelProps> = ({ token }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [time, setTime] = useState({ hours: 0, minutes: 0, seconds: 0 });

  const { id: selectedTaskId, project_id } = useSelectTask()

  console.log(project_id, selectedTaskId)

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isRunning) {
      interval = setInterval(() => {
        setTime((prevTime) => {
          let newSeconds = prevTime.seconds + 1;
          let newMinutes = prevTime.minutes;
          let newHours = prevTime.hours; CounterPanel

          if (newSeconds === 60) {
            newSeconds = 0;
            newMinutes += 1;
          }

          if (newMinutes === 60) {
            newMinutes = 0;
            newHours += 1;
          }

          if (newHours === 24) {
            newHours = 0;
          }

          const info = { project_id, selectedTaskId, hours: newHours, minutes: newMinutes, seconds: newSeconds };

          window.electron.ipcRenderer.send('timer-update', info);

          return info;
        });
      }, 1000);
    } else if (interval) {
      clearInterval(interval);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning]);

  useEffect(() => {
    const handleToggleTimer = () => {
      setIsRunning((prevIsRunning) => {
        const newIsRunning = !prevIsRunning;
        window.electron.ipcRenderer.send('timer-status-update', newIsRunning);
        return newIsRunning;
      });
    };
    const unsubscribe = window.electron.ipcRenderer.on('toggle-timer', handleToggleTimer);
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (isRunning) {
      setIsRunning(false);
      window.electron.ipcRenderer.send('timer-status-update', false);

      pauseTask(project_id, selectedTaskId);

    }
  }, [selectedTaskId]);

  const toggleTimer = () => {
    setIsRunning((prevIsRunning) => {
      const newIsRunning = !prevIsRunning;
      window.electron.ipcRenderer.send('timer-status-update', newIsRunning);
      return newIsRunning;
    });
  };

  const startTask = async (project_id: number, task_id: number) => {
    try {
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
      const { success, message, data } = await res.json();

      if (!success) {
        toast(`${message}`);
        return;
      }
      toast(`${message} : ${data.task.name}`);
    } catch (error) {
      toast("Failed to start task tracking");
    }
  };

  const pauseTask = async (project_id: number, task_id: number) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/track/pause`, {
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
      const { success, message, data } = await res.json();

      if (!success) {
        toast(`${message}`);
        return;
      }
      toast(`${message} : ${data.task.name}`);
    } catch (error) {
      toast("Failed to pause task tracking");
    }
  };

  const formatTime = (value: number) => {
    return value.toString().padStart(2, '0');
  };

  return (
    <div className="w-full">
      <div className="flex flex-col items-center gap-5">
        <div className='flex justify-center'>
          <p className='bg-gray-400 text-white mt-5 font-bold text-2xl px-28'>
            {`${formatTime(time.hours)}:${formatTime(time.minutes)}:${formatTime(time.seconds)}`}
          </p>
        </div>
        <div className='flex justify-center'>
          {!isRunning ? (
            <button
              disabled={project_id === -1 || selectedTaskId === -1}
              onClick={() => {
                toggleTimer();
                startTask(project_id, selectedTaskId);
              }}
            >
              <FaCirclePlay
                className={cn(
                  "w-12 h-12 text-blue-500 cursor-pointer",
                  (project_id === -1 || selectedTaskId === -1) && "text-gray-300 cursor-not-allowed"
                )}
              />
            </button>
          ) : (
            <button
              disabled={project_id === -1 || selectedTaskId === -1}
              onClick={() => {
                toggleTimer();
                pauseTask(project_id, selectedTaskId);
              }}
            >
              <FaCirclePause
                className={cn(
                  "w-12 h-12 text-blue-500 cursor-pointer",
                  (project_id === -1 || selectedTaskId === -1) && "text-gray-300 cursor-not-allowed"
                )}
              />
            </button>
          )}
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