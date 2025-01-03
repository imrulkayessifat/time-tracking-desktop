import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query";

import Loader from "./Loader"
import { cn } from "../lib/utils";
import { useSelectProject } from "./hooks/project/use-select-project";
import { useSelectTask } from "./hooks/task/use-select-task";
import { useSelectProjectTask } from "./hooks/use-select-projecttask";
import { useGetProjects } from "./hooks/project/use-get-projects"
import { useTimerCleanup } from "./hooks/timer/useTimerCleanup";
import useAttendanceTracker from "./hooks/attendance/use-attendance-tracker";
import { useGetTimer } from "./hooks/timer/useGetTimer";

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

interface ProjectsProps {
  token: string;
  isExpanded: boolean;
  isRunning:boolean;
  toggleExpand: () => void;
  handleTimerToggle: () => Promise<void>;
  searchProject: ProjectData
}

const Project: React.FC<ProjectsProps> = ({
  token,
  isExpanded,
  isRunning,
  toggleExpand,
  handleTimerToggle,
  searchProject
}) => {
  const [page, setPage] = useState(1)
  const queryClient = useQueryClient();
  const { chosen_project_id, setTask } = useSelectTask()
  const { init_project_id, init_task_id, setProjectTask } = useSelectProjectTask()
  const { cleanupTimers } = useTimerCleanup();
  // const { isOnline } = useAttendanceTracker({ token })
  const { getProjectTime } = useGetTimer();

  const { data, isLoading } = useGetProjects({ page, token })
  const { project_id, setProject } = useSelectProject()

  if (isLoading) {
    return (
      <Loader />
    )
  }
  cleanupTimers()

  const projects = searchProject?.rows.length > 0 ? searchProject.rows : data?.rows || []
  const meta = searchProject?.meta ? searchProject.meta : data?.meta

  const handlePrevPage = () => {
    if (page > 1) {
      setPage(prev => prev - 1)
    }
  }

  const handleNextPage = () => {
    if (meta && page < meta.total_pages) {
      setPage(prev => prev + 1)
    }
  }

  const formatTime = (hours: number, minutes: number, seconds: number): string => {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  return (
    <>
      <div className="relative overflow-x-auto">
        <table className="w-full text-sm text-left rtl:text-right text-gray-500">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3">
                Project
              </th>
              {/* <th scope="col" className="px-6 py-3">
              </th> */}
            </tr>
          </thead>
          {
            projects.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={2}>
                    <div className='w-full h-48 flex flex-col items-center justify-center'>
                      <img src="/images/empty.svg" alt="No projects found" className="max-w-[200px]" />
                      <span className='text-black'>No project assigned here</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody className="flex flex-col">
                {
                  projects.map((project, index) => {
                    // const { hours, minutes, seconds, isRunning } = getProjectTime(project.id);
                    return (
                      <button
                        disabled={ isRunning && (project.id !== project_id || project.id !== chosen_project_id)}
                        onClick={() => {
                          setProject(project.id, -1)
                          queryClient.invalidateQueries({ queryKey: ["tasks"] })
                          setProjectTask(project.id, -1)
                          setTask(-1, -1)
                        }}
                        key={index}
                        className={cn("bg-white cursor-pointer", index !== projects.length - 1 && 'border-b', (project.id === project_id || project.id === chosen_project_id) && ' bg-[#294DFF] text-white')}
                      >
                        <th scope="row" className={cn("flex gap-3 px-6 py-4 font-medium text-gray-900 whitespace-nowrap", (project.id === project_id || project.id === chosen_project_id) && 'text-white')}>
                          <button
                            onClick={handleTimerToggle}
                            disabled={init_project_id === -1}
                          >
                            {
                              !isRunning ? (
                                <img src={`${init_project_id === project.id && init_task_id === -1 ? '/images/individualstart.svg' : '/images/disable.png'}`} className={cn("w-[20px] h-[20px] cursor-pointer", init_project_id === -1 && 'cursor-not-allowed')} />
                              ) : (
                                <img src={`${init_project_id === project.id && init_task_id === -1 ? "/images/pause.png" : '/images/disable.png'}`} className={cn("w-[20px] h-[20px] cursor-pointer")} />
                              )
                            }
                          </button>
                          <span>{project.name}</span>
                        </th>
                        {/* <td className="px-6 py-4">
                          {formatTime(hours, minutes, seconds)}
                        </td> */}
                      </button>
                    )
                  })
                }
              </tbody>
            )
          }

        </table>
      </div>
      {
        projects.length !== 0 && meta && (
          <div className="flex justify-between my-4 w-full">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevPage}
                disabled={1 === Number(meta.current_page)}
                className={cn("flex gap-1 items-center w-[60px] h-8 border border-gray-950 rounded-md px-[10px] py-[6px]", 1 === Number(meta.current_page) && "opacity-20 cursor-not-allowed")}>
                <img src="/images/arrowleft.png" className="" />
                <span className="text-gray-950 leading-5 font-light">Back</span>
              </button>
              {/* <button className="w-8 h-8 bg-[#294DFF] text-white rounded-md text-lg p-[3px]">{page}</button> */}
              <button
                onClick={handleNextPage}
                disabled={meta.total_pages === Number(meta.current_page)}
                className={cn(page === Number(meta.total_pages) && "opacity-20 cursor-not-allowed")}
              >
                <img src="/images/next.png" />
              </button>
            </div>
            <button onClick={toggleExpand}>
              {isExpanded ? (
                <img src="/images/toggleleft.svg" />
              ) : (
                <img src="/images/toggleright.svg" />
              )}
            </button>
          </div>
        )
      }
    </>
  )
}

export default Project