"use client";

import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from "react-resizable-panels";

export function ResizablePanelGroup({
  direction,
  children,
  className,
}: {
  direction: "horizontal" | "vertical";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <PanelGroup direction={direction} className={className}>
      {children}
    </PanelGroup>
  );
}

export function ResizablePanel({
  defaultSize,
  minSize,
  children,
  className,
}: {
  defaultSize: number;
  minSize?: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Panel defaultSize={defaultSize} minSize={minSize} className={className}>
      {children}
    </Panel>
  );
}

export function ResizableHandle() {
  return (
    <PanelResizeHandle className="mx-1 my-1 flex items-center justify-center">
      <div className="h-1 w-8 rounded-full bg-border transition-colors hover:bg-border-focus data-[resize-handle-state=drag]:bg-blue" />
    </PanelResizeHandle>
  );
}
