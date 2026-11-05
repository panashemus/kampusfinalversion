'use client';
import {useEffect,useState,type ImgHTMLAttributes} from 'react';
import {resolveMediaUrls} from '@/lib/media';
export default function SecureImage({src,alt='',...props}:ImgHTMLAttributes<HTMLImageElement>){
 const [resolved,setResolved]=useState<string>();
 useEffect(()=>{let live=true;setResolved(undefined);if(!src)return;
 if(src.startsWith('data:image/')||src.startsWith('blob:')||src.startsWith('/images/')){setResolved(src);return;}
 const refresh=()=>resolveMediaUrls([src]).then(urls=>{if(live)setResolved(urls[0]);});void refresh();
 const timer=setInterval(refresh,240000);return()=>{live=false;clearInterval(timer);};},[src]);
 if(!resolved)return <span role="img" aria-label={alt||'Image unavailable'} className={props.className}/>;
 // User media comes from a private Supabase bucket; URLs expire in five minutes.
 // eslint-disable-next-line @next/next/no-img-element
 return <img {...props} loading="lazy" src={resolved} alt={alt}/>;
}
