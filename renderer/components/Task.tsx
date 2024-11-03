import { useState } from 'react'

import Loader from './Loader';
import { cn } from '../lib/utils';
import { useGetTasks } from './hooks/task/use-get-tasks';
import { useSelectTask } from './hooks/task/use-select-task';
import { useSelectProject } from './hooks/project/use-select-project';
import { useSelectProjectTask } from './hooks/use-select-projecttask';
import { useGetTimer } from './hooks/timer/useGetTimer';

interface TaskMeta {
    total_records: number;
    total_pages: number;
    current_page: number;
    page_size: string;
}

interface TaskData {
    rows: any[];
    meta: TaskMeta;
}

interface TaskProps {
    token: string;
    status: string;
    searchTask: TaskData;
}

const Task: React.FC<TaskProps> = ({
    token,
    status,
    searchTask
}) => {
    const [taskPage, setTaskPage] = useState(1)
    const { project_id, setProject } = useSelectProject()
    const { setProjectTask } = useSelectProjectTask()
    const { getTaskTime } = useGetTimer();
    const { chosen_project_id, chosen_task_id, setTask } = useSelectTask()

    const projectIdToUse = project_id === -1 ? chosen_project_id : project_id

    const { data, isLoading } = useGetTasks({ taskPage, token, projectId: projectIdToUse, status })

    if (isLoading) {
        return (
            <Loader />
        )
    }

    const tasks = searchTask?.rows.length > 0 ? searchTask.rows : data?.rows || []
    const meta = searchTask?.meta ? searchTask.meta : data?.meta

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

    const formatTime = (hours: number, minutes: number, seconds: number): string => {
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    return (
        <>
            <div className='relative overflow-x-auto'>
                <table className="w-full text-sm text-left rtl:text-right text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                        <tr>
                            <th scope="col" className="px-6 py-3">
                                Task
                            </th>
                            <th scope="col" className="px-6 py-3">
                                Created
                            </th>
                            <th scope="col" className="px-6 py-3">
                            </th>
                        </tr>
                    </thead>
                    {
                        tasks.length === 0 ? (
                            <tbody>
                                <tr>
                                    <td colSpan={3}>
                                        <div className='w-full h-48 flex flex-col items-center justify-center'>
                                            <img src="/images/empty.svg" alt="No tasks found" className="max-w-[200px]" />
                                            <span className='text-black'>No task assigned here</span>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        ) : (
                            <tbody>
                                {
                                    tasks.map((task, index) => {
                                        const { hours, minutes, seconds } = getTaskTime(task.project_id, task.id);
                                        return (
                                            <tr
                                                onClick={() => {
                                                    setTask(task.project_id, task.id)
                                                    setProjectTask(task.project_id, task.id)
                                                    setProject(-1, -1)
                                                }}
                                                key={index}
                                                className={cn("bg-white dark:bg-gray-800 dark:border-gray-700 cursor-pointer", index !== tasks.length - 1 && 'border-b', task.id === chosen_task_id && ' bg-[#294DFF] text-white')}
                                            >
                                                <th scope="row" className={cn("px-6 text-sm py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white", task.id === chosen_task_id && 'text-white')}>
                                                    {task.name}
                                                </th>
                                                <td className="px-6 py-4 text-sm">
                                                    {task.createdAt.split('T')[0]}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {formatTime(hours, minutes, seconds)}
                                                </td>
                                            </tr>
                                        )
                                    })
                                }
                            </tbody>
                        )
                    }
                </table>
            </div>
            {
                tasks.length !== 0 && meta && (
                    <div className="flex my-4 w-full">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handlePrevPage}
                                disabled={1 === Number(meta.current_page)}
                                className={cn("flex gap-1 items-center w-[60px] h-8 border border-gray-950 rounded-md px-[10px] py-[6px]", 1 === Number(meta.current_page) && "opacity-20 cursor-not-allowed")}>
                                <img src="/images/arrowleft.png" className="" />
                                <span className="text-gray-950 leading-5 font-light">Back</span>
                            </button>
                            {/* <button className="w-8 h-8 bg-[#294DFF] text-white rounded-md text-lg p-[3px]">{taskPage}</button> */}
                            <button
                                onClick={handleNextPage}
                                disabled={meta.total_pages === Number(meta.current_page)}
                                className={cn(taskPage === Number(meta.total_pages) && "opacity-20 cursor-not-allowed")}
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

export default Task