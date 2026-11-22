import {submitCirkles} from '@/lib/server/cirkles-submit';
export const runtime='nodejs';
export async function POST(req:Request){return submitCirkles(req,'post');}
