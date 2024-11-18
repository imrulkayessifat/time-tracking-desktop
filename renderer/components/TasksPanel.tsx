import {
  useState,
  useEffect,
  ChangeEvent,
  MouseEvent,
  FormEvent,
  useTransition
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner"
import { DivideIcon, X } from 'lucide-react';
import * as DialogPrimitive from "@radix-ui/react-dialog"

import Task from "./Task";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "./ui/dialog";
import { cn } from "../lib/utils";
import { useTaskTimer } from "./hooks/timer/useTaskTimer";
import { useSelectStatus } from "./hooks/task/use-status";
import { useSelectTask } from "./hooks/task/use-select-task";
import { useSelectProjectTask } from "./hooks/use-select-projecttask";
import { useSelectProject } from "./hooks/project/use-select-project";
import { useCreateTask } from "./hooks/task/use-create-task";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

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

interface TasksPanelProps {
  isExpanded: boolean;
  hasTaskStorePermission: boolean;
  isRunning: boolean;
  handleTimerToggle: () => Promise<void>
  pause: () => void;
  token: string
}

const TasksPanel: React.FC<TasksPanelProps> = ({
  token,
  hasTaskStorePermission,
  handleTimerToggle,
  isRunning,
  pause,
  isExpanded
}) => {
  const queryClient = useQueryClient();
  const { status, setStatus } = useSelectStatus()
  // const [status, setStatus] = useState('in_progress');
  const [isPending, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState<string>('');
  const [searchTask, setSearchTask] = useState<TaskData>()

  const { chosen_project_id, chosen_task_id } = useSelectTask()
  const mutation = useCreateTask({ token })
  const { init_project_id, init_task_id } = useSelectProjectTask()
  const { project_id } = useSelectProject()

  useEffect(() => {
    if (chosen_task_id !== -1) {
      toast.warning(`You need to start Task :  ${chosen_project_id}_${chosen_task_id}`, {
        duration: 1000,
      })
    }
  }, [chosen_task_id])

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setSearchValue(event.target.value);
  };
  const handleStatusChange = (value) => {
    if (value === '') {
      console.log("value ", value);
      setStatus('in_progress');
    } else {
      setStatus(value);
    }
    queryClient.invalidateQueries({ queryKey: ["tasks"] })
  };


  const handleSearch = async (e: MouseEvent<HTMLButtonElement>): Promise<void> => {
    e.preventDefault();
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/task/project/${init_project_id}?page=1&limit=5&query=${searchValue}`, {
      method: 'GET',
      headers: {
        'Authorization': `${token}`,
      }
    });
    if (!res.ok) {
      throw new Error("Failed to fetch tasks");
    }
    const { data } = await res.json();
    setSearchTask(data)
  };

  const handleClearSearch = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setSearchValue('') // Prevent default form submission
    setSearchTask(undefined);
  };

  const createTask = async (data: any) => {
    const { success } = await mutation.mutateAsync(data)
    console.log("success", success)
    if (!success) {
      return { error: 'Task create failed!' }
    }

    return { success: 'Task create successfully' }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const name = formData.get('name')
    const description = formData.get('description')
    const data = {
      name,
      project_id,
      description
    }
    startTransition(() => {
      const promise = createTask(data)

      toast.promise(promise, {
        loading: 'Creating Subscription...',
        success: (data) => {
          if (data.error) {
            return `Creating Subscription failed: ${data.error}`
          } else {

            return `Creating Subscription successful: ${data.success}`
          }
        },
        error: 'An unexpected error occurred',
      })
    });

  }

  const endTask = async (init_project_id: number, init_task_id: number) => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/track/end`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `${token}`
      },
      body: JSON.stringify({
        project_id: init_project_id,
        task_id: init_task_id
      })
    });
    const { success, message } = await res.json();

    if (success) {
      toast.success(`Task end successfull : ${init_project_id} ${init_task_id} ${message}`, {
        duration: 1000,
      });
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
    } else {
      toast.error(`Track end : Something went wrong ${init_project_id} ${init_task_id} ${message}`, {
        duration: 5000,
      });
    }
  }

  return (
    <div className={cn('flex flex-col h-screen px-5 gap-4 border-l', isExpanded && 'w-1/2')}>
      <div className="flex flex-col gap-8">
        <div className="w-full flex justify-between">
          <p className='text-xl leading-[25px] font-normal'>Tasks</p>
          {
            hasTaskStorePermission && project_id !== -1 && (
              <Dialog>
                <DialogTrigger asChild>
                  <button className="flex justify-between items-center gap-4 text-[#294DFF]">
                    <img src="/images/create.svg" />
                    <span>Create Tasks</span>
                  </button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[594px] sm:min-h-[337px] m-[0px] p-[26px]">
                  <form onSubmit={handleSubmit}>
                    <div className="flex flex-col gap-6">
                      <div className="flex justify-between">
                        <p className="font-medium text-xl">New Task</p>
                        <DialogPrimitive.Close disabled={isPending} className=" rounded-sm ring-offset-background transition-opacity hover:opacity-100 focus:outline-none disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
                          <X className="h-4 w-4" />
                          {/* <span className="sr-only">Close</span> */}
                        </DialogPrimitive.Close>
                      </div>
                      <div className="flex flex-col gap-6">
                        <div className="flex flex-col gap-1 w-full">
                          <span className="font-light text-[14px]">Task*</span>
                          <input disabled={isPending} type="text" name="name" required className="min-h-9 p-[10px] rounded-md border border-[#D5D5D5]" placeholder="Add task" />
                        </div>
                      </div>
                      <div className="flex flex-col gap-6">
                        <div className="flex flex-col gap-1 w-full">
                          <span className="font-light text-[14px]">Task Details*</span>
                          <textarea disabled={isPending} name="description" required className="min-h-16 p-[10px] rounded-md border border-[#D5D5D5]" placeholder="Details...">

                          </textarea>
                        </div>
                      </div>
                      <div className="flex justify-end gap-[18px]">
                        <DialogPrimitive.Close>
                          <button disabled={isPending} className="h-9 w-[100px] font-normal text-[14px] py-[8px] px-[28.5px] rounded-md border border-[#D5D5D5]">Cancel</button>
                        </DialogPrimitive.Close>
                        <button disabled={isPending} type="submit" className="h-9 w-[100px] font-normal text-[14px] py-[8px] px-[28.5px] rounded-md border border-[#D5D5D5] text-white bg-[#294DFF]">Save</button>
                      </div>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            )
          }
        </div>

        <div className="flex w-full gap-2">
          <form className="flex items-center w-2/3">
            <div className="relative w-full">
              <div className="absolute inset-y-0 start-0 flex items-center ps-3">
                <button
                  onClick={handleSearch}
                  disabled={searchValue.length === 0}
                  className={cn("", searchValue.length === 0 && "opacity-30 cursor-not-allowed")}
                >
                  <img
                    src="/images/search.png"
                    className={"h-[26px] w-[26px] cursor-pointer"}
                  />
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
          <form className="flex items-center w-1/3">
            <div className="relative w-full">
              <Select value={status} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="pending">To Do</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              {status !== 'in_progress' && (
                <button
                  onClick={(e) => { e.stopPropagation(); setStatus('in_progress') }}
                  className="absolute inset-y-0 end-8 flex items-center ps-3"
                  type="button"
                >
                  <X className="text-red-500 w-5 h-5" />
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
      <Task token={token} handleTimerToggle={handleTimerToggle} searchTask={searchTask} status={status} />
      {(init_task_id !== -1 && isRunning) && (<div className="mt-5 border-t">

        <div className="flex items-center justify-between mt-3">
          <p>Task Id : {init_task_id}</p>
          <button onClick={async () => {
            await endTask(init_project_id, init_task_id)
            pause()
            window.electron.ipcRenderer.send('idle-stopped', { projectId: init_project_id, taskId: init_task_id });
          }} disabled={init_task_id === -1} className={cn("border rounded px-3 py-2", init_task_id === -1 && 'opacity-50')}>Completed</button>
        </div>
      </div>
      )}
    </div>
  )
}

export default TasksPanel