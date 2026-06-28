/**
 * renderer.tsx — Extension entry point (renderer process only).
 *
 * Pattern verified against alebcay/openlens-node-pod-menu, the canonical
 * real-world OpenLens 6.5.x extension reference:
 *  - Default export is the class (not a named export)
 *  - clusterPageMenus[].target wraps the pageId
 *  - Use Renderer.LensExtension (NOT the deprecated LensRendererExtension)
 */

import { Renderer } from "@k8slens/extensions";
import React from "react";
import { ChatPanel } from "./components/ChatPanel";

export default class KubeChatExtension extends Renderer.LensExtension {
  clusterPages = [
    {
      id: "kube-chat",
      components: {
        Page: () => <ChatPanel />,
      },
    },
  ];

  clusterPageMenus = [
    {
      // "target" wrapper is required — pageId alone will NOT work
      target: { pageId: "kube-chat" },
      title: "Kube Chat",
      components: {
        Icon: (props: Renderer.Component.IconProps) => (
          <Renderer.Component.Icon {...props} material="chat" />
        ),
      },
    },
  ];
}
