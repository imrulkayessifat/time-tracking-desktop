import { useState } from "react"
import { FaAngleLeft, FaAngleRight } from "react-icons/fa6";

import Loader from "./Loader"
import { cn } from "../lib/utils";
import { useSelectProject } from "./hooks/project/use-select-project";
import { useGetProjects } from "./hooks/project/use-get-projects"

interface ProjectsProps {
  token: string
}

const Project: React.FC<ProjectsProps> = ({
  token
}) => {
  const [page, setPage] = useState(1)
  const { id:selectedProjectId, setProjectId } = useSelectProject()
  const { data, isLoading } = useGetProjects({ page, token })

  if (isLoading) {
    return (
      <Loader />
    )
  }

  const projects = data?.rows || []
  const meta = data?.meta

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

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-semibold tracking-tight">Project List :</h1>
      <div className="flex gap-2">
        <p className="text-sm bg-orage-400 rounded-md tracking-tight px-2 py-2">
          Total Pages : {meta.total_pages}
        </p>
        <p className="text-sm bg-emerald-400 rounded-md tracking-tight px-2 py-2">
          Total Records : {meta.total_records}
        </p>
        <p className="text-sm bg-cyan-400 rounded-md tracking-tight px-2 py-2">
          Current Page : {meta.current_page}
        </p>
      </div>
      <div className="flex flex-col gap-3">
        {
          projects.map((project, index) => (
            <div key={index} className={cn("border rounded-md border-gray-400", project.id === selectedProjectId && 'border-blue-400 bg-blue-400')}>
              <button onClick={() => setProjectId(project.id)} className="w-full text-left py-5 pl-2 hover:text-gray-700">
                {project.name}
              </button>
            </div>
          ))
        }
      </div>
      <div>
        {
          meta && (
            <div className="flex justify-between">
              <button
                onClick={handlePrevPage}
                disabled={1 === Number(meta.current_page)}
                className={cn("border p-2 rounded-md border-gray-400 disabled:hover:border-gray-400 hover:border-blue-400", 1 === Number(meta.current_page) && "cursor-not-allowed")}
              >
                <FaAngleLeft />
              </button>
              <button
                onClick={handleNextPage}
                disabled={meta.total_pages === Number(meta.current_page)}
                className={cn("border p-2 rounded-md border-gray-400 disabled:hover:border-gray-400 hover:border-blue-400", page === Number(meta.total_pages) && "cursor-not-allowed")}
              >
                <FaAngleRight />
              </button>
            </div>
          )
        }
      </div>
    </div>
  )
}

export default Project