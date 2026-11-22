'use client';
import {useId} from 'react';
export default function CirklesLogo({size=32,variant='brand',className=''}:{size?:number;variant?:'brand'|'nav'|'badge';className?:string}){
 const id=useId().replace(/:/g,'');const brand=variant==='brand';
 return <svg width={size} height={size} viewBox="0 0 128 128" fill="none" aria-hidden="true" focusable="false" className={className}>
  {brand&&<defs>
   <linearGradient id={`${id}-outer`} x1="23" y1="115" x2="105" y2="12" gradientUnits="userSpaceOnUse"><stop stopColor="#819bd9"/><stop offset=".4" stopColor="#effcff"/><stop offset=".72" stopColor="#c8e5f4"/><stop offset="1" stopColor="#8ba2db"/></linearGradient>
   <radialGradient id={`${id}-inner`} cx=".35" cy=".25" r=".9"><stop stopColor="#effcff"/><stop offset="1" stopColor="#8ba2db"/></radialGradient>
  </defs>}
  <g stroke={brand?`url(#${id}-outer)`:'currentColor'} strokeWidth={variant==='badge'?14:15} strokeLinecap="round">
   <path d="M54 17 A48 48 0 0 1 99 97"/>
   <path d="M33 28 A48 48 0 0 0 30 98"/>
   <path d="M48 110 A48 48 0 0 0 78 111"/>
  </g>
  <circle cx="64" cy="64" r="24" stroke={brand?`url(#${id}-inner)`:'currentColor'} strokeWidth={variant==='badge'?9:7}/>
 </svg>;
}
