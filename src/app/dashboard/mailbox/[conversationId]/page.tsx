import { MessageInput } from "../_components/message-input";
import { ConversationHeader } from "../_components/conversation-header";

// Mock data - in a real app, this would come from your DAL
const conversations = [
  {
    id: "1",
    user: {
      name: "Emily K.",
      avatar: "/avatar-anna.png",
      initials: "EK",
    },
    lastMessage:
      "I'd like to borrow your drill set for the weekend if it's available.",
    time: "10:23 AM",
    unread: true,
    messages: [
      {
        id: "1",
        sender: "them",
        content:
          "Hi there! I noticed you have a drill set listed. I'd like to borrow it for the weekend if it's available.",
        time: "10:23 AM",
      },
      {
        id: "2",
        sender: "me",
        content:
          "Hi Emily! Yes, the drill set is available this weekend. When would you like to pick it up?",
        time: "10:45 AM",
      },
      {
        id: "3",
        sender: "them",
        content:
          "That's great! Would Saturday morning around 9 AM work for you?",
        time: "11:02 AM",
      },
    ],
  },
  {
    id: "2",
    user: {
      name: "John D.",
      avatar: "",
      initials: "JD",
    },
    lastMessage: "Thanks for returning the pressure washer on time!",
    time: "Yesterday",
    unread: false,
    messages: [
      {
        id: "1",
        sender: "them",
        content: "Thanks for returning the pressure washer on time!",
        time: "Yesterday",
      },
    ],
  },
  {
    id: "3",
    user: {
      name: "Maria G.",
      avatar: "",
      initials: "MG",
    },
    lastMessage: "Don't forget to return the circular saw by Friday.",
    time: "May 22",
    unread: false,
    messages: [
      {
        id: "1",
        sender: "them",
        content: "Don't forget to return the circular saw by Friday.",
        time: "May 22",
      },
    ],
  },
];

interface ConversationPageProps {
  params: {
    conversationId: string;
  };
}

export default function ConversationPage({ params }: ConversationPageProps) {
  const { conversationId } = params;

  const selectedThread = conversations.find((c) => c.id === conversationId);

  if (!selectedThread) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="text-center">
          <h3 className="mb-2 text-lg font-medium">Conversation not found</h3>
          <p className="text-muted-foreground text-sm">
            The conversation you&apos;re looking for doesn&apos;t exist.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <ConversationHeader user={selectedThread.user} />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-6">
          {selectedThread.messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === "me" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.sender === "me"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <p>{message.content}</p>
                <div
                  className={`mt-1 text-right text-xs ${
                    message.sender === "me"
                      ? "text-primary-foreground/80"
                      : "text-muted-foreground/80"
                  }`}
                >
                  {message.time}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <MessageInput />
    </div>
  );
}
