import { useState } from 'react'
import { FaAngleLeft, FaAngleRight } from 'react-icons/fa6';

import Loader from './Loader';
import { cn } from '../lib/utils';
import { useGetTasks } from './hooks/task/use-get-tasks';
import { useSelectProject } from './hooks/project/use-select-project';
import { useSelectTask } from './hooks/task/use-select-task';

interface TaskProps {
    token: string;
}

const Task: React.FC<TaskProps> = ({
    token
}) => {
    const [taskPage, setTaskPage] = useState(1)
    const { id: projectId } = useSelectProject()
    const { id: selectedTaskId, setTaskId } = useSelectTask()

    const { data, isLoading } = useGetTasks({ taskPage, token, projectId })

    if (isLoading) {
        return (
            <Loader />
        )
    }

    const tasks = data?.rows || []
    const meta = data?.meta

    const handlePrevPage = () => {
        if (taskPage > 1) {
            setTaskPage(prev => prev - 1)
        }
    }

    const handleNextPage = () => {
        if (meta && taskPage < meta.total_pages) {
            setTaskPage(prev => prev + 1)
        }
    }
    if (tasks.length === 0) {
        return (
            <div className='flex items-center justify-center'>
                <p>No project selected or project task empty</p>
            </div>
        )
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
                    tasks.map((task, index) => (
                        <div key={index} className={cn("border rounded-md border-gray-400", task.id === selectedTaskId && 'border-purple-500 bg-purple-500')}>
                            <button onClick={() => setTaskId(task.id)} className="w-full text-left py-5 pl-2 hover:text-gray-700">
                                {task.name}
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
                                className={cn("border p-2 rounded-md border-gray-400 disabled:hover:border-gray-400 hover:border-blue-400", taskPage === Number(meta.total_pages) && "cursor-not-allowed")}
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

export default Task