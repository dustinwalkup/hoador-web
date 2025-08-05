export default async function ArchivedMailboxPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center">
      <div className="text-center">
        <h3 className="mb-2 text-lg font-medium">
          Select an archived conversation
        </h3>
        <p className="text-muted-foreground text-sm">
          Choose a conversation from the archived list to view messages
        </p>
      </div>
    </div>
  );
}
