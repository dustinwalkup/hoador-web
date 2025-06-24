import RentalCard from "@/components/dashboard/rental-card";

export function LentOutTab() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <RentalCard
        name="Drill Set"
        id={"123"}
        borrower="Emily K."
        imageUrl="/images/mock/drill-set.jpg"
        dueDate="May 26, 2023"
        status="lent"
        price="$10/day"
      />
      <RentalCard
        name="Lawn Mower"
        id={"123"}
        borrower="David P."
        imageUrl="/images/mock/lawn-mower.jpg"
        dueDate="June 2, 2023"
        status="lent"
        price="$20/day"
      />
    </div>
  );
}
