import { Input } from "@/components/ui/input";
import Image from "next/image";

const CARTOON_IMAGE_URL = "/images/cartoon.png";

export default function ExplorePage() {
  return (
    <main className="bg-skyBlue pt-24">
      <Input className="bg-white" />
      <Image
        src={CARTOON_IMAGE_URL}
        width={334}
        height={112}
        alt="Cartoon image of neighbors sharing tools."
        className="w-full"
        priority
      />
    </main>
  );
}
