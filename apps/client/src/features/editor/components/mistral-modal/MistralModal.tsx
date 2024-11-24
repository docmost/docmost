import React, { useState, useEffect } from 'react';
import { IconRobot } from '@tabler/icons-react';
import { NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import { mistralService } from '@/features/editor/services/mistral-service';
import { ActionIcon, Flex, Popover, Stack, Textarea } from "@mantine/core";
import { v4 } from "uuid";
import { IconTrashX, IconSend } from "@tabler/icons-react";
import classes from './mistral.module.css';

export default function MistralModal(props: NodeViewProps) {
  const { node, updateAttributes, editor, getPos } = props;
  const [prompt, setPrompt] = useState(node.attrs.prompt || '');
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const textAreaRef = React.useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setIsEditing(!!props.selected);
    if (props.selected) setPrompt(node.attrs.prompt || '');
  }, [props.selected]);

  const insertMarkdownContent = (markdown: string) => {
    // Convertir les blocs de code
    let content = markdown.replace(/```(\w+)?\n([\s\S]*?)```/gm, (_, language, code) => {
      return `<pre><code class="language-${language || 'plaintext'}">${code.trim()}</code></pre>`;
    });

    // Convertir les titres (de h1 à h6)
    content = content.replace(/^#{6}\s+(.*)$/gm, '<h6>$1</h6>');
    content = content.replace(/^#{5}\s+(.*)$/gm, '<h5>$1</h5>');
    content = content.replace(/^#{4}\s+(.*)$/gm, '<h4>$1</h4>');
    content = content.replace(/^#{3}\s+(.*)$/gm, '<h3>$1</h3>');
    content = content.replace(/^#{2}\s+(.*)$/gm, '<h2>$1</h2>');
    content = content.replace(/^#{1}\s+(.*)$/gm, '<h1>$1</h1>');

    // Convertir le gras
    content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Convertir l'italique
    content = content.replace(/\*(.*?)\*/g, '<em>$1</em>');
    content = content.replace(/_(.*?)_/g, '<em>$1</em>');

    // Convertir les listes à puces
    content = content.replace(/^\- (.*$)/gm, '<ul><li>$1</li></ul>');
    content = content.replace(/<\/ul>\n<ul>/g, '');

    // Convertir les listes numérotées
    content = content.replace(/^\d+\. (.*$)/gm, '<ol><li>$1</li></ol>');
    content = content.replace(/<\/ol>\n<ol>/g, '');

    // Convertir les liens
    content = content.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // Convertir les citations
    content = content.replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>');

    // Convertir les lignes horizontales
    content = content.replace(/^---$/gm, '<hr>');

    // Convertir le code inline
    content = content.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Convertir les paragraphes
    content = content.split('\n\n').map(p => {
      if (!p.trim()) return '';
      if (p.startsWith('<')) return p; // Ne pas envelopper le HTML existant
      return `<p>${p.trim()}</p>`;
    }).join('\n');

    return content;
  };

  const handleSubmit = async () => {
    if (!prompt.trim()) return;

    setIsLoading(true);
    try {
      const completion = await mistralService.getCompletion(prompt);
      
      // Obtenir la position actuelle du nœud
      const pos = getPos();
      
      // Supprimer d'abord le nœud Mistral
      const tr = editor.state.tr.delete(pos, pos + node.nodeSize);
      editor.view.dispatch(tr);
      
      // Puis insérer le contenu Markdown converti à la même position
      const htmlContent = insertMarkdownContent(completion);
      editor
        .chain()
        .focus(pos)
        .insertContent(htmlContent)
        .run();

    } catch (error) {
      console.error('Error in Mistral AI completion:', error);
    } finally {
      setIsLoading(false);
      setIsEditing(false);
    }
  };

  return (
    <Popover
      opened={isEditing && editor.isEditable}
      trapFocus
      position="top"
      shadow="md"
      width={500}
      withArrow={true}
      zIndex={101}
      id={v4()}
    >
      <Popover.Target>
        <NodeViewWrapper
          className={[
            classes.mistralBlock,
            props.selected ? classes.selected : '',
            !node.attrs.completion ? classes.empty : '',
          ].join(' ')}
          onClick={() => {
            if (!isEditing) {
              setIsEditing(true);
              editor.commands.focus(getPos());
            }
          }}
        >
          <div className="flex items-center gap-2 p-2">
            <IconRobot className="h-5 w-5 text-blue-600" />
            <span>Click to add Mistral AI prompt</span>
          </div>
        </NodeViewWrapper>
      </Popover.Target>

      <Popover.Dropdown>
        <Stack>
          <Textarea
            minRows={4}
            maxRows={8}
            autosize
            ref={textAreaRef}
            draggable="false"
            value={prompt}
            placeholder="Enter your prompt here..."
            classNames={{ input: classes.textInput }}
            onBlur={(e) => {
              e.preventDefault();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
                return;
              }

              if (e.key === "Escape") {
                setIsEditing(false);
                return editor.commands.focus(getPos() + node.nodeSize);
              }

              if (!textAreaRef.current) return;

              const { selectionStart, selectionEnd } = textAreaRef.current;

              if (
                (e.key === "ArrowLeft" || e.key === "ArrowUp") &&
                selectionStart === selectionEnd &&
                selectionStart === 0
              ) {
                editor.commands.focus(getPos() - 1);
              }

              if (
                (e.key === "ArrowRight" || e.key === "ArrowDown") &&
                selectionStart === selectionEnd &&
                selectionStart === textAreaRef.current?.value.length
              ) {
                editor.commands.focus(getPos() + node.nodeSize);
              }
            }}
            onChange={(e) => {
              setPrompt(e.target.value);
            }}
          />

          <Flex justify="flex-end" align="flex-end" gap="md">
            <ActionIcon 
              variant="light" 
              color="blue"
              loading={isLoading}
              onClick={handleSubmit}
              disabled={!prompt.trim()}
            >
              <IconSend size={18} />
            </ActionIcon>
            <ActionIcon 
              variant="light" 
              color="red"
              onClick={() => props.deleteNode()}
            >
              <IconTrashX size={18} />
            </ActionIcon>
          </Flex>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
