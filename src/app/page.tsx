import type { Metadata } from "next";
import { PhotoPosterHeader, PhotoPosterTool } from "@/components/tools/photo-poster/PhotoPosterTool";

export const metadata: Metadata = {
  title: "BE4 THE POST",
  description: "上傳一張照片，拖曳挖空方塊，生成帶有詩意文案的社群海報。",
};

export default function Home() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-bg lg:px-[200px]">
      <PhotoPosterHeader />
      <div className="min-h-0 flex-1">
        <PhotoPosterTool />
      </div>
    </div>
  );
}
