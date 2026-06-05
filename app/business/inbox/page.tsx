"use client";

import React from "react";
import { DbBackedInbox } from "@/components/inbox/DbBackedInbox";

export default function BusinessInbox() {
  return (
    <DbBackedInbox
      audience="business"
      eyebrow="Workspace overview"
      title="Business Inbox"
      description="Database-backed affiliate messages, launch invites, campaign context, and Nettmark alerts without jumping between business tools."
      emptyTitle="No submissions in this view"
      emptyDescription="Encourage affiliates to submit creatives or send launch invites through your offer workflow."
      selectTitle="Select a message"
      selectDescription="Choose an item on the left to see sender details, offer or campaign context, and quick actions."
      suggestionCards={[
        {
          title: "Need more affiliate activity?",
          body: "Create or refresh an offer so affiliates can request access and send promotion updates.",
          href: "/business/my-business/create-offer",
          label: "Create offer",
        },
      ]}
    />
  );
}
