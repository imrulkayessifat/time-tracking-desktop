import { Skeleton } from '../components/ui/Skeleton';

const Loader = () => {
    return (
        <div className="max-w-screen-xl mx-auto w-full pb-10 mt-24">
            <div className="flex items-center space-x-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                    <Skeleton className="h-4 w-[250px]" />
                    <Skeleton className="h-4 w-[200px]" />
                </div>
            </div>
        </div>
    )
}

export default Loader