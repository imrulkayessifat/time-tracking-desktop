import { Separator } from "./ui/separator";
import { useSelectProject } from "./hooks/project/use-select-project";
import Task from "./Task";

interface TasksPanelProps {
  token: string
}

const TasksPanel: React.FC<TasksPanelProps> = ({
  token
}) => {
  const { id: selectedProjectId } = useSelectProject()
  return (
    <div className='w-full flex flex-col justify-between h-screen min-w-[480px]'>
      <div className="mx-2 mt-2 flex flex-col gap-3 justify-between">
        <div className='flex justify-between items-center'>
          <p className='font-bold text-xl'>Tasks : </p>
        </div>
        <Separator className="bg-gray-300 w-full" />
        <Task token={token} />
      </div>
    </div>
  )
}

export default TasksPanel