import { useEffect } from 'react';
import { useRouter } from 'next/router';

const ClientSideRedirect = () => {
  const router = useRouter();

  useEffect(() => {
    router.push('/home');
  }, [router]);

  return null;
};

export default ClientSideRedirect;