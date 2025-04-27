// app/providers.jsx
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        gcTime: 72 * 60 * 60 * 1000, // 24 hours
        retry: 0,
      },
    },
  });
}

const queryClient = makeQueryClient();

const persister = typeof window !== 'undefined'
  ? createSyncStoragePersister({ storage: window.localStorage })
  : undefined;

export function QueryProvider({ children }) {
  if (!persister) return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister }}
      onSuccess={() => {
        queryClient.resumePausedMutations().then(() => {
          queryClient.invalidateQueries();
        });
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
