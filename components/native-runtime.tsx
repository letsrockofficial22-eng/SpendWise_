'use client';
import {useEffect} from 'react';
import {App} from '@capacitor/app';
import {Browser} from '@capacitor/browser';
import {Capacitor, type PluginListenerHandle} from '@capacitor/core';
import {StatusBar,Style} from '@capacitor/status-bar';

export function NativeRuntime(){
  useEffect(()=>{
    if(!Capacitor.isNativePlatform())return;
    let active=true;
    let backListener:PluginListenerHandle|undefined;
    let authLinkListener:PluginListenerHandle|undefined;

    void StatusBar.setBackgroundColor({color:'#f7f9f7'}).catch(error=>console.error('Could not set Android status bar color.',error));
    void StatusBar.setStyle({style:Style.Light}).catch(error=>console.error('Could not set Android status bar style.',error));
    void App.addListener('backButton',({canGoBack})=>{
      if(canGoBack||window.history.length>1){
        window.history.back();
      }else if(window.confirm('Exit SpendWise?')){
        void App.exitApp();
      }
    }).then(listener=>{backListener=listener}).catch(error=>console.error('Could not register Android back-button handling.',error));
    const handleAppUrl=(url:string)=>{
      let link:URL;
      try{
        link=new URL(url);
      }catch(error){
        console.error('Received an invalid Android app link.',error);
        return;
      }
      if(link.protocol!=='spendwise:'||link.hostname!=='auth'||!['/confirm','/callback'].includes(link.pathname))return;
      void Browser.close().catch(error=>console.error('Could not close the authentication browser.',error));
      window.location.assign(`/auth${link.pathname}${link.search}${link.hash}`);
    };
    void App.getLaunchUrl().then(launch=>{if(launch?.url)handleAppUrl(launch.url)}).catch(error=>console.error('Could not read the Android launch link.',error));
    void App.addListener('appUrlOpen',({url})=>handleAppUrl(url)).then(listener=>{authLinkListener=listener;if(!active)void listener.remove()}).catch(error=>console.error('Could not register Android authentication links.',error));
    const handleExternalLink=(event:MouseEvent)=>{
      if(!(event.target instanceof Element))return;
      const anchor=event.target.closest('a[href]');
      if(!(anchor instanceof HTMLAnchorElement))return;
      const target=new URL(anchor.href,window.location.href);
      if(target.origin===window.location.origin||!['http:','https:'].includes(target.protocol))return;
      event.preventDefault();
      void Browser.open({url:target.href}).catch(error=>console.error('Could not open the external link.',error));
    };
    document.addEventListener('click',handleExternalLink,true);

    return()=>{
      active=false;
      document.removeEventListener('click',handleExternalLink,true);
      void backListener?.remove();
      void authLinkListener?.remove();
    };
  },[]);

  return null;
}
