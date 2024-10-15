import { Loader2 } from 'lucide-react';

import {
    Card,
    CardHeader,
    CardContent
} from "../components/ui/Card"
import { Skeleton } from '../components/ui/Skeleton';
const Loader = () => {
    return (
        <div className="max-w-screen-2xl mx-auto w-full pb-10 mt-24">
            <Card className='border-none'>
                <CardHeader>
                    <Skeleton className='h-8 w-48' />
                </CardHeader>
                <CardContent>
                    <div className='h-[500px] w-full flex items-center justify-center'>
                        <Loader2
                            className='size-6 text-slate-100 animate-spin'
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

export default Loader