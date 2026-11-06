import {describe,it,expect} from 'vitest';
import {canRestoreOfflineSession,isPrivateRoute,privateRouteLoginHref,withSessionTimeout} from '../lib/auth-routing';

describe('protected route helpers',()=>{
  it('identifies protected routes and their nested pages',()=>{
    expect(isPrivateRoute('/transactions')).toBe(true);
    expect(isPrivateRoute('/transactions/new')).toBe(true);
    expect(isPrivateRoute('/tools')).toBe(true);
    expect(isPrivateRoute('/loans')).toBe(true);
    expect(isPrivateRoute('/shared-expenses')).toBe(true);
    expect(isPrivateRoute('/login')).toBe(false);
  });

  it('preserves the requested page when signing in',()=>{
    expect(privateRouteLoginHref('/budgets')).toBe('/login?next=%2Fbudgets&reason=session');
  });

  it('restores a cached session offline without allowing online signed-out access',()=>{
    expect(canRestoreOfflineSession(true,false)).toBe(true);
    expect(canRestoreOfflineSession(true,true)).toBe(false);
    expect(canRestoreOfflineSession(false,false)).toBe(false);
  });

  it('restores a cached session when Supabase token refresh fails due to network',()=>{
    const error=new Error('Network request failed');
    error.name='AuthRetryableFetchError';
    expect(canRestoreOfflineSession(true,true,error)).toBe(true);
    expect(canRestoreOfflineSession(true,true,new Error('Invalid refresh token'))).toBe(false);
  });

  it('times out a stalled session check as a retryable network error',async()=>{
    await expect(withSessionTimeout(new Promise(()=>{}),1)).rejects.toMatchObject({
      name:'AuthRetryableFetchError',
    });
  });
});
