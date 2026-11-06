import type {Metadata,Viewport} from 'next';
import './globals.css';
import './features.css';
import {StoreProvider} from '../components/store';
import {NativeRuntime} from '../components/native-runtime';
export const metadata:Metadata={title:'SpendWise — Make every taka count',description:'A little clarity for your everyday spending.'};
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><StoreProvider><NativeRuntime/>{children}</StoreProvider></body></html>}
