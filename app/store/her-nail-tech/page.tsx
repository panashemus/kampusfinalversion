import type {Metadata} from 'next';
import HerNailTechStorefront from '@/components/HerNailTechStorefront';

export const metadata:Metadata={
 title:'HER NAIL TECH | Nail Lookbook & Bookings · KAMPUS Hustle Hub',
 description:'Explore nail designs, booking policies and WhatsApp enquiries for HER NAIL TECH in Tlokweng, Metlhabeng. Curated by KAMPUS Hustle Hub.',
 openGraph:{title:'HER NAIL TECH · The Nail Lookbook',description:'Browse nail sets and book directly through HER NAIL TECH. Featured on KAMPUS Hustle Hub.',type:'website'},
};
export default function HerNailTechPage(){return <HerNailTechStorefront/>;}
