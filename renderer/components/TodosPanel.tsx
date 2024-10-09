import { CiMenuKebab } from "react-icons/ci";

const TodosPanel = () => {
  return (
    <div className='w-full flex flex-col justify-between h-screen min-w-[480px]'>
        <div className="mx-2 mt-2 flex flex-col justify-between">
            <div className='flex justify-between items-center'>
                <p className='font-bold text-xl'>To-dos</p>
                <CiMenuKebab className="w-4 h-4 cursor-pointer" />
            </div>
        </div>
        <footer className="border-t px-2">
            <span className="text-xs text-black/70">showing 0 of 0 to-dos</span>
        </footer>
    </div>
  )
}

export default TodosPanel