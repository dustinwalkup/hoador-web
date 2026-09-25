import { describe, it, expect, vi } from "vitest";

/** SEC-12: user-controlled text is escaped before it reaches email HTML. */

const mockSendNotification = vi.fn();
vi.mock("@/features/notifications/utils/send-notification", () => ({
  sendNotification: (...a: unknown[]) => mockSendNotification(...a),
}));

import { sendMessageReceivedNotification } from "../message-received";

const POISON = '<a href="https://evil.example">Verify payout</a>';

describe("sendMessageReceivedNotification (SEC-12)", () => {
  it("escapes the sender's name in the email HTML", async () => {
    await sendMessageReceivedNotification({
      userId: "u-1",
      to: "u@example.com",
      senderName: POISON,
      conversationId: "c-1",
    });

    const html = mockSendNotification.mock.calls[0][0].email.html as string;
    expect(html).not.toContain('<a href="https://evil.example"');
    expect(html).toContain("&lt;a href=&quot;https://evil.example&quot;&gt;");
  });
});
