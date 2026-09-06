import React from "react";
import { render } from "@testing-library/react";
import { MessageList } from "../components/MessageList";

describe("MessageList Component", () => {
  const mockContext = {
    clusterName: "test-cluster",
    server: "http://test-server",
    namespace: "default",
  };

  it("renders diagnostic troubleshooting prompts in the empty state", () => {
    const { getByText } = render(
      <MessageList messages={[]} isLoading={false} context={mockContext} />
    );

    expect(
      getByText('"Diagnose failing pods & recent warning events"')
    ).toBeInTheDocument();
    expect(
      getByText('"Why is a pod crashing or failing in the cluster?"')
    ).toBeInTheDocument();
    expect(
      getByText('"Show recent warning events across all namespaces"')
    ).toBeInTheDocument();
  });
});
