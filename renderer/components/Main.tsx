import { useState } from "react";

import Footer from "./Footer";
import TasksPanel from "./TasksPanel";
import CounterPanel from "./CounterPanel";

interface MainProps {
  token: string
}

const Main: React.FC<MainProps> = ({
  token
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpand = () => {
    setIsExpanded((prev) => !prev);
    window.electron.ipcRenderer.send('toggle-expand', isExpanded);
  };

  return (
    <div className="flex w-full">
      <div className='flex flex-col justify-between h-screen w-[500px]  min-w-[500px] max-w-[500px] border-r'>
        <CounterPanel token={token} />
        <Footer isExpanded={isExpanded} toggleExpand={toggleExpand} />
      </div>
      {
        isExpanded && (
          <TasksPanel token={token} />
        )
      }
    </div>
  );
};

export default Main;