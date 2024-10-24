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
  const [taskTimers, setTaskTimers] = useState<Record<string, TaskTimer>>({});
  const [currentTime, setCurrentTime] = useState<TimeState>({ hours: 0, minutes: 0, seconds: 0 });
  const [previousTask, setPreviousTask] = useState<{ projectId: number; taskId: number } | null>(null);

  const { id: selectedTaskId, project_id } = useSelectTask();
  console.log(project_id, selectedTaskId)
  // Load saved timers from electron store on component mount
  useEffect(() => {
    window.electron.ipcRenderer.send('load-timers');

    const handleLoadedTimers = (savedTimers: Record<string, TaskTimer>) => {
      setTaskTimers(savedTimers);
      // Set current time if there's a saved state for the selected task
      const timerKey = `${project_id}-${selectedTaskId}`;
      if (savedTimers[timerKey]) {
        setCurrentTime(savedTimers[timerKey].time);
      }
    };

    const unsubscribe = window.electron.ipcRenderer.on('timers-loaded', handleLoadedTimers);
    return unsubscribe;
  }, []);

  // Handle timer updates
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isRunning && selectedTaskId !== -1 && project_id !== -1) {
      interval = setInterval(() => {
        setCurrentTime((prevTime) => {
          let newSeconds = prevTime.seconds + 1;
          let newMinutes = prevTime.minutes;
          let newHours = prevTime.hours;

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

          const newTime = { hours: newHours, minutes: newMinutes, seconds: newSeconds };

          // Update task timer state
          const timerKey = `${project_id}-${selectedTaskId}`;
          const updatedTimers = {
            ...taskTimers,
            [timerKey]: {
              projectId: project_id,
              taskId: selectedTaskId,
              time: newTime
            }
          };

          setTaskTimers(updatedTimers);

          // Save to electron store
          window.electron.ipcRenderer.send('save-timers', updatedTimers);

          // Send timer update
          window.electron.ipcRenderer.send('timer-update', {
            project_id,
            selectedTaskId,
            ...newTime
          });

          return newTime;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, selectedTaskId, project_id]);

  // Load task-specific timer when task selection changes
  useEffect(() => {
    const handleTaskChange = async () => {
      if (selectedTaskId !== -1 && project_id !== -1) {
        // If there's a previous task running, pause it
        if (isRunning && previousTask && (previousTask.projectId !== project_id || previousTask.taskId !== selectedTaskId)) {
          await pauseTask(previousTask.projectId, previousTask.taskId);
        }

        setIsRunning(false);
        window.electron.ipcRenderer.send('timer-status-update', false);
        toast.warning("Heads up!", {
          description: "You need to start the task!",
        });

        const timerKey = `${project_id}-${selectedTaskId}`;
        const savedTimer = taskTimers[timerKey];
        if (savedTimer) {
          setCurrentTime(savedTimer.time);
        } else {
          setCurrentTime({ hours: 0, minutes: 0, seconds: 0 });
        }

        // Update previous task reference
        setPreviousTask({ projectId: project_id, taskId: selectedTaskId });
      }
    };

    handleTaskChange();
  }, [selectedTaskId, project_id]);

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
      const { success, message } = await res.json();

      if (!success) {
        toast(`${message}`);
        return;
      }
      toast(`${message}`);
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
      const { success, message } = await res.json();

      if (!success) {
        toast(`${message}`);
        return;
      }
      toast(`${message}`);
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
            {`${formatTime(currentTime.hours)}:${formatTime(currentTime.minutes)}:${formatTime(currentTime.seconds)}`}
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