import { RxDoubleArrowRight,RxDoubleArrowLeft } from "react-icons/rx";

interface FooterProps {
    isExpanded:boolean;
    toggleExpand:()=>void
}
const Footer:React.FC<FooterProps> = ({
    isExpanded,
    toggleExpand
}) => {
  return (
    <footer className='border-t'>
        <div className='flex flex-row-reverse px-2 py-1'>
            {isExpanded ? (
                <RxDoubleArrowLeft 
                    className="text-black/60 cursor-pointer" 
                    onClick={toggleExpand}
                />
            ) : (
                <RxDoubleArrowRight 
                    className="text-black/60 cursor-pointer" 
                    onClick={toggleExpand}
                />
            )}        
        </div>
    </footer>
  )
}

export default Footer