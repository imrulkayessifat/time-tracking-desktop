import { useState } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/router";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import TasksPanel from "./TasksPanel";
import CounterPanel from "./CounterPanel";

interface MainProps {
  token: string
}

const Main: React.FC<MainProps> = ({
  token
}) => {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const toggleExpand = () => {
    setIsExpanded((prev) => !prev);
    window.electron.ipcRenderer.send('toggle-expand', isExpanded);
  };
  console.log(isExpanded)
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
                signOut();
                router.push('/home')
              }}
            >
              <span>Sign Out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex w-full">
        <CounterPanel isExpanded={isExpanded} toggleExpand={toggleExpand} token={token} />
        {
          isExpanded && (
            <TasksPanel isExpanded={isExpanded} token={token} />
          )
        }
      </div>
    </div>
  );
};

export default Main;