import {describe,it,expect} from 'vitest';
import {buildContactMailto,contactEmail} from '../lib/contact';

describe('contact mail link',()=>{
  it('addresses the owner and includes a safely encoded bug report',()=>{
    const url=new URL(buildContactMailto({
      name:'Tamim & Friends',
      email:'user@example.com',
      topic:'Bug report',
      message:'Income is not added to my balance.',
    }));
    expect(url.protocol).toBe('mailto:');
    expect(url.pathname).toBe(contactEmail);
    expect(url.searchParams.get('subject')).toBe('SpendWise Bug report');
    expect(url.searchParams.get('body')).toContain('Income is not added to my balance.');
    expect(url.searchParams.get('body')).toContain('Tamim & Friends');
  });
});
