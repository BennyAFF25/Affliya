"use client";

import React from "react";
import { DbBackedInbox } from "@/components/inbox/DbBackedInbox";

export default function AffiliateInbox() {
  return (
    <DbBackedInbox
      audience="affiliate"
      eyebrow="Workspace overview"
      title="Affiliate Inbox"
      description="Database-backed messages, launch invites, offer context, and Nettmark alerts in one streamlined lane."
      emptyTitle="Nothing in this view yet"
      emptyDescription="Switch tabs or head to the marketplace to find launch opportunities."
      selectTitle="Select a message"
      selectDescription="Choose an item on the left to see the sender, offer context, read state, and next action."
      suggestionCards={[
        {
          title: "Want new offers?",
          body: "Head to the marketplace to discover fresh offers and request promotion access.",
          href: "/affiliate/marketplace",
          label: "Open marketplace",
        },
      ]}
    />
  );
}
