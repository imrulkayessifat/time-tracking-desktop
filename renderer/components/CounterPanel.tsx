import {
  ChangeEvent,
  MouseEvent,
  useEffect,
  useState
} from "react";
import { toast } from "sonner"

import Project from "./Project";
import { cn } from '../lib/utils';
import { useTaskTimer } from "./hooks/timer/useTaskTimer";
import { useSelectProject } from "./hooks/project/use-select-project";
import { X } from "lucide-react";
import { useSelectTask } from "./hooks/task/use-select-task";
import { useSelectProjectTask } from "./hooks/use-select-projecttask";


interface ProjectMeta {
  total_records: number;
  total_pages: number;
  current_page: number;
  page_size: string;
}

interface ProjectData {
  rows: any[];
  meta: ProjectMeta;
}
interface CounterPanelProps {
  token: string;
  hours: number
  minutes: number
  seconds: number
  isRunning: boolean
  isExpanded: boolean;
  handleTimerToggle: () => Promise<void>
  toggleExpand: () => void
}

const CounterPanel: React.FC<CounterPanelProps> = ({
  token,
  isExpanded,
  toggleExpand,
  handleTimerToggle,
  hours,
  minutes,
  seconds,
  isRunning
}) => {

  const [searchValue, setSearchValue] = useState<string>('');
  const [searchProject, setSearchProject] = useState<ProjectData>()
  const { project_id, task_id } = useSelectProject();
  const { init_project_id, init_task_id } = useSelectProjectTask()

  useEffect(() => {
    if (project_id !== -1) {
      toast.warning(`You need to start Project ${project_id}`, {
        duration: 1000,
      })
    }
  }, [project_id])

  const formatTime = (value: number) => {
    return value.toString().padStart(2, '0');
  };

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setSearchValue(event.target.value);
  };

  const handleSearch = async (e: MouseEvent<HTMLButtonElement>): Promise<void> => {
    e.preventDefault();
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/project?page=1&limit=5&query=${searchValue}`, {
      method: 'GET',
      headers: {
        'Authorization': `${token}`,
      }
    });
    if (!res.ok) {
      throw new Error("Failed to fetch tasks");
    }
    const { data } = await res.json();
    setSearchProject(data)
  };

  const handleClearSearch = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setSearchValue('') // Prevent default form submission
    setSearchProject(undefined);
  };

  return (
    <div className={cn('flex flex-col w-full  px-5 gap-4', isExpanded && 'w-1/2')}>
      <div className="flex flex-col gap-8">
        <p className='text-xl leading-[25px] font-normal'>My Projects</p>
        <p className='text-base leading-5 font-normal bg-[#294DFF] h-9 py-2 text-center text-white'>
          {`${formatTime(hours)}:${formatTime(minutes)}:${formatTime(seconds)}`}
        </p>
        <div className="flex items-center justify-center">
          <button
            onClick={handleTimerToggle}
            disabled={init_project_id === -1}
          >
            {
              !isRunning ? (
                <img src={`${init_project_id !== -1 ? '/images/start.png' : '/images/disable.png'}`} className={cn("w-[50px] h-[50px] cursor-pointer", init_project_id === -1 && 'cursor-not-allowed')} />
              ) : (
                <img src="/images/pause.png" className={cn("w-[50px] h-[50px] cursor-pointer")} />
              )
            }
          </button>
        </div>

        <form className="flex items-center w-full mx-auto">
          <div className="relative w-full">
            <div className="absolute inset-y-0 start-0 flex items-center ps-3">
              <button
                onClick={handleSearch}
                disabled={searchValue.length === 0}
                className={cn("", searchValue.length === 0 && "opacity-30 cursor-not-allowed")}
              >
                <img src="/images/search.png" className="h-[26px] w-[26px] cursor-pointer" />
              </button>
            </div>
            <input
              value={searchValue}
              onChange={handleSearchChange}
              type="text"
              className=" border block w-full ps-10 p-2.5"
            />
            <div className={cn("absolute inset-y-0 end-2 flex items-center ps-3", searchValue.length === 0 && "hidden")}>
              <button
                onClick={handleClearSearch}
              >
                <X
                  className={"h-[26px] w-[26px] cursor-pointer"}
                />
              </button>
            </div>
          </div>
        </form>
      </div>

      <Project isExpanded={isExpanded} handleTimerToggle={handleTimerToggle} toggleExpand={toggleExpand} token={token} searchProject={searchProject} />
    </div>
  );
};

export default CounterPanel;