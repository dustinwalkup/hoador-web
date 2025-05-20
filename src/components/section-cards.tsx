import Image from "next/image";

import { Card, CardFooter, CardHeader } from "@/components/ui/card";

export function SectionCards() {
  return (
    <div className="flex gap-4 overflow-x-auto px-4">
      <Card className="@container/card w-full min-w-[80%] gap-0 pt-0">
        <CardHeader className="px-0">
          <div className="aspect-video w-full">
            <Image
              src={"/images/mock/garage-stock.png"}
              width={284}
              height={189}
              alt="Tools Pegboard"
              className="h-full w-full rounded-t-xl"
            />
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 px-4 pt-2 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Recently added in Verona Hills
          </div>
          <div className="text-muted-foreground">See more</div>
        </CardFooter>
      </Card>
      <Card className="@container/card w-full min-w-[80%] gap-0 pt-0">
        <CardHeader className="px-0">
          <div className="aspect-video w-full">
            <Image
              src={"/images/mock/tools-pegboard.jpg"}
              width={284}
              height={189}
              alt="Tools Pegboard"
              className="h-full w-full rounded-t-xl"
            />
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 px-4 pt-2 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Recently added in Verona Hills
          </div>
          <div className="text-muted-foreground">See more</div>
        </CardFooter>
      </Card>
    </div>
  );
}
