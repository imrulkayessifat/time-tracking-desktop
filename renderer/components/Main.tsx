import { useState } from "react";

import Footer from "./Footer";
import TodosPanel from "./TodosPanel";
import CounterPanel from "./CounterPanel";

const Main: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpand = () => {
    setIsExpanded((prev) => !prev);
    window.electron.ipcRenderer.send('toggle-expand',isExpanded);
  };

  return (
    <div className="flex w-full">
      <div className='flex flex-col justify-between h-screen w-[500px]  min-w-[500px] max-w-[500px] border-r'>
        <CounterPanel />
        <Footer isExpanded={isExpanded} toggleExpand={toggleExpand}/>
      </div>
      {
        isExpanded && (
          <TodosPanel />
        )
      }
    </div>
  );
};

export default Main;