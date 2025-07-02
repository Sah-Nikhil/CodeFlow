import React from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";

export interface DirectoryNode {
  name: string;
  path: string;
  children?: DirectoryNode[];
}

interface DirectoryTreeProps {
  tree: DirectoryNode[];
  onFileClick?: (filePath: string) => void;
}

const DirectoryTree: React.FC<DirectoryTreeProps> = ({ tree, onFileClick }) => {
  // Recursive render for directory tree using Accordion
  const renderTree = (nodes: DirectoryNode[], parentPath = "") => (
    <ul className="pl-0">
      {nodes.map((node) => (
        <li key={node.path} className="mb-1">
          {node.children ? (
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value={node.path} className="border-none">
                <AccordionTrigger className="px-2 py-1 rounded hover:bg-muted/50 text-left font-semibold">
                  <span className="mr-2">📁</span>
                  {node.name.charAt(0).toUpperCase() + node.name.slice(1)}
                </AccordionTrigger>
                <AccordionContent className="pl-2">
                  {renderTree(node.children, node.path)}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          ) : (
            <Button
              variant="ghost"
              className="w-full justify-start px-2 py-1 text-blue-700 hover:bg-blue-50 rounded ml-6"
              onClick={() => onFileClick?.(node.path)}
            >
              <span className="mr-2">📄</span>
              {node.name}
            </Button>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <div className="h-fill w-fit py-2">{renderTree(tree)}</div>
  );
};

export default DirectoryTree;
