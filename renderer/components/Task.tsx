import { useState } from 'react'
import { FaAngleLeft, FaAngleRight } from 'react-icons/fa6';

import Loader from './Loader';
import { cn } from '../lib/utils';
import { useGetTasks } from './hooks/task/use-get-tasks';
import { useSelectTask } from './hooks/task/use-select-task';
import { useSelectProject } from './hooks/project/use-select-project';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem } from '../components/ui/select';

interface TaskProps {
    token: string;
}

const Task: React.FC<TaskProps> = ({
    token
}) => {
    const [taskPage, setTaskPage] = useState(1)
    const { project_id, setProject } = useSelectProject()
    const { chosen_project_id, chosen_task_id, setTask } = useSelectTask()

    const projectIdToUse = project_id === -1 ? chosen_project_id : project_id

    const { data, isLoading } = useGetTasks({ taskPage, token, projectId: projectIdToUse })

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
                    <tbody>
                        {
                            tasks.map((task, index) => (
                                <tr
                                    onClick={() => {
                                        setTask(task.project_id, task.id)
                                        setProject(-1, -1)
                                    }}
                                    key={index}
                                    className={cn("bg-white hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 cursor-pointer", index !== tasks.length - 1 && 'border-b', task.id === chosen_task_id && ' bg-[#294DFF] text-white')}
                                >
                                    <th scope="row" className={cn("px-6 text-sm py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white", task.id === chosen_task_id && 'text-white')}>
                                        {task.name}
                                    </th>
                                    <td className="px-6 py-4 text-sm">
                                        {task.createdAt.split('T')[0]}
                                    </td>
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
                            <button className="w-8 h-8 bg-[#294DFF] text-white rounded-md text-lg p-[3px]">{taskPage}</button>
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