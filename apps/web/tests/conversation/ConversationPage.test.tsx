// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ConversationPage } from "../../src/conversation/ConversationPage";
import {
  channel,
  dm,
  person,
  useFakeStore,
  workspaceBody,
} from "../support/conversation-store";

vi.mock("../../src/client", async () =>
  (await import("../support/conversation-store")).clientModule(),
);

beforeEach(async () => {
  const h = useFakeStore(
    workspaceBody(
      [channel("c1", "general"), dm("d1", "p1")],
      [person("p1", "Alex Phạm")],
    ),
  );
  await h.loadNow();
});

describe("the placeholder page (R21)", () => {
  test("draws one element with the test id and the name in an h1", () => {
    render(<ConversationPage conversationId="c1" onBack={() => {}} />);
    const page = screen.getByTestId("conversation-page");
    expect(page.querySelector("h1")).toHaveTextContent("general");
    expect(page.querySelector("main")).toBeNull();
  });

  test("a direct message is named with the other person", () => {
    render(<ConversationPage conversationId="d1" onBack={() => {}} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Alex Phạm",
    );
  });
});
