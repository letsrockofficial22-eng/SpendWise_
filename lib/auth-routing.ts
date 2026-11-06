const privateRoutes = ['/dashboard', '/transactions', '/budgets', '/reports', '/settings', '/profile', '/notifications', '/tools', '/loans', '/shared-expenses', '/monthly-summary', '/backup'];

export function isPrivateRoute(pathname: string) {
  return privateRoutes.some(path => pathname === path || pathname.startsWith(`${path}/`));
}

export function privateRouteLoginHref(pathname: string) {
  const query = new URLSearchParams({ next: pathname, reason: 'session' });
  return `/login?${query.toString()}`;
}

export function canRestoreOfflineSession(hasCachedAccount: boolean, isOnline: boolean, error?: unknown) {
  const retryableNetworkError=error instanceof Error&&(
    error.name==='AuthRetryableFetchError'||
    error.message.toLowerCase().includes('fetch')
  );
  return hasCachedAccount&&(!isOnline||retryableNetworkError);
}

export function withSessionTimeout<T>(session:Promise<T>, timeoutMs=1500):Promise<T>{
  let timeout:ReturnType<typeof setTimeout>;
  const timedOut=new Promise<never>((_,reject)=>{
    timeout=setTimeout(()=>{
      const error=new Error('Session check timed out.');
      error.name='AuthRetryableFetchError';
      reject(error);
    },timeoutMs);
  });
  return Promise.race([session,timedOut]).finally(()=>clearTimeout(timeout));
}
