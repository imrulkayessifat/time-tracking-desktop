import { useState, useEffect } from "react";
import { FaCirclePlay, FaCirclePause } from "react-icons/fa6";

import { Separator } from "./ui/separator";
import Project from "./Project";

interface CounterPanelProps {
  token: string
}

const CounterPanel: React.FC<CounterPanelProps> = ({
  token
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [time, setTime] = useState({ hours: 0, minutes: 0, seconds: 0 });

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

          const newTime = { hours: newHours, minutes: newMinutes, seconds: newSeconds };

          window.electron.ipcRenderer.send('timer-update', newTime);

          return newTime;
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

  const toggleTimer = () => {
    setIsRunning((prevIsRunning) => {
      const newIsRunning = !prevIsRunning;
      window.electron.ipcRenderer.send('timer-status-update', newIsRunning);
      return newIsRunning;
    });
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
          {
            !isRunning ?
              <FaCirclePlay
                onClick={toggleTimer}
                className="w-12 h-12 text-blue-500 cursor-pointer"
              />
              :
              <FaCirclePause
                onClick={toggleTimer}
                className="w-12 h-12 text-blue-500 cursor-pointer"
              />
          }
        </div>
        <Separator className="bg-gray-300 w-11/12" />
        <div className="w-full px-5">
          <Project token={token} />
        </div>
      </div>
    </div>
  )
}

export default CounterPanel