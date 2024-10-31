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
  return (
    <div className="flex w-full h-screen">
      <div className="w-20 bg-[#294DFF]">
        <div className="flex flex-col justify-between h-full">
          <div className="flex flex-col items-center">
            <img src='/images/projects.png' className="w-9 h-9 mx-5 mt-5" />
            <span className="text-white text-xs">Projects</span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger className="mb-10 p-0 cursor-pointer" asChild>
              <img src='/images/profile.png' className="w-9 h-9 mx-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" className="w-56 bg-white">
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
      </div>
      <div className="flex w-full max-h-full">
        <CounterPanel token={token} />
        <TasksPanel token={token} />
      </div>
    </div>
  );
};

export default Main;