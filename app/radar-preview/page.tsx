import { notFound } from "next/navigation";
import RadarPreview from "./preview";
export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <RadarPreview />;
}
