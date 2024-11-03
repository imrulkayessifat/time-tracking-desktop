import { useState } from "react"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

import Loader from "./Loader"
import { cn } from "../lib/utils";
import { useSelectProject } from "./hooks/project/use-select-project";
import { useSelectTask } from "./hooks/task/use-select-task";
import { useGetProjects } from "./hooks/project/use-get-projects"
import { useTimerCleanup } from "./hooks/timer/useTimerCleanup";

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
  searchProject: ProjectData
}

const Project: React.FC<ProjectsProps> = ({
  token,
  searchProject
}) => {
  const [page, setPage] = useState(1)
  const { chosen_project_id, setTask } = useSelectTask()
  const { cleanupTimers } = useTimerCleanup();
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

  if (projects.length === 0) {
    return (
      <div className='flex items-center justify-center'>
        <p>No project available</p>
      </div>
    )
  }

  return (
    <>
      <div className="relative overflow-x-auto">
        <table className="w-full text-sm text-left rtl:text-right text-gray-500 dark:text-gray-400">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
            <tr>
              <th scope="col" className="px-6 py-3">
                Project
              </th>
              <th scope="col" className="px-6 py-3">
              </th>
            </tr>
          </thead>
          <tbody>
            {
              projects.map((project, index) => (
                <tr
                  onClick={() => {
                    setProject(project.id, -1)
                    setTask(-1, -1)
                  }}
                  key={index}
                  className={cn("bg-white dark:bg-gray-800 dark:border-gray-700 cursor-pointer", index !== projects.length - 1 && 'border-b', (project.id === project_id || project.id === chosen_project_id) && ' bg-[#294DFF] text-white')}
                >
                  <th scope="row" className={cn("px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white", (project.id === project_id || project.id === chosen_project_id) && 'text-white')}>
                    {project.name}
                  </th>
                  <td className="px-6 py-4">
                    00:00:00
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
      {
        meta && (
          <div className="flex justify-between my-4 w-full">
            <div className="flex gap-2 items-center">
              <p className="text-[14px] leading-5 font-medium">Result Per Page</p>
              <Select defaultValue="5">
                <SelectTrigger isArrow={false} className="w-8 h-8 rounded-md p-2 appearance-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent side="right" align="start">
                  <SelectGroup>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevPage}
                disabled={1 === Number(meta.current_page)}
                className={cn("flex gap-1 items-center w-[60px] h-8 border border-gray-950 rounded-md px-[10px] py-[6px]", 1 === Number(meta.current_page) && "opacity-20 cursor-not-allowed")}>
                <img src="/images/arrowleft.png" className="" />
                <span className="text-gray-950 leading-5 font-light">Back</span>
              </button>
              <button className="w-8 h-8 bg-[#294DFF] text-white rounded-md text-lg p-[3px]">{page}</button>
              <button
                onClick={handleNextPage}
                disabled={meta.total_pages === Number(meta.current_page)}
                className={cn(page === Number(meta.total_pages) && "opacity-20 cursor-not-allowed")}
              >
                <img src="/images/next.png" />
              </button>
            </div>
          </div>
        )
      }
    </>
  )
}

export default Project