# Guide d'ajout d'une nouvelle fonctionnalité à l'éditeur UbberDoc

Ce guide détaille les étapes nécessaires pour ajouter une nouvelle fonctionnalité à l'éditeur, en prenant comme exemple l'implémentation de Mistral AI. Il couvre l'architecture, les bonnes pratiques et les pièges à éviter.

## Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Structure des fichiers](#structure-des-fichiers)
3. [Étapes d'implémentation](#étapes-dimplémentation)
4. [Bonnes pratiques](#bonnes-pratiques)
5. [Dépannage](#dépannage)

## Vue d'ensemble

L'éditeur UbberDoc est basé sur TipTap, un framework d'édition de texte riche construit sur ProseMirror. Pour ajouter une nouvelle fonctionnalité, nous devons :

1. Créer une extension TipTap
2. Implémenter un composant React pour l'interface utilisateur
3. Intégrer la fonctionnalité dans le menu slash
4. Gérer les interactions et les états

## Structure des fichiers

Pour une nouvelle fonctionnalité (exemple avec Mistral AI) :

```
apps/client/src/features/editor/
├── components/
│   └── mistral-modal/
│       ├── MistralModal.tsx       # Composant React principal
│       └── mistral.module.css     # Styles spécifiques
├── extensions/
│   ├── mistral-extension.ts       # Extension TipTap
│   └── extensions.ts              # Liste des extensions
├── services/
│   └── mistral-service.ts         # Service API (si nécessaire)
└── components/slash-menu/
    └── menu-items.ts              # Configuration du menu slash
```

## Étapes d'implémentation

### 1. Créer l'extension TipTap

```typescript
// mistral-extension.ts
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import YourModal from '../components/your-modal/YourModal';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    yourFeature: {
      setYourFeature: () => ReturnType;
    };
  }
}

export const YourFeatureBlock = Node.create({
  name: 'yourFeatureBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      // Définir les attributs nécessaires
      attributeOne: {
        default: '',
      },
      attributeTwo: {
        default: '',
      },
    };
  },

  addCommands() {
    return {
      setYourFeature:
        () =>
        ({ chain }) => {
          return chain()
            .insertContent({
              type: this.name,
              attrs: {
                attributeOne: '',
                attributeTwo: '',
              },
            })
            .focus()
            .run();
        },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(YourModal);
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="your-feature-block"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-type': 'your-feature-block' }, HTMLAttributes)];
  },
});
```

### 2. Créer le composant React

```typescript
// YourModal.tsx
import React, { useState, useEffect } from 'react';
import { NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import { ActionIcon, Flex, Popover, Stack, Textarea } from "@mantine/core";
import { v4 } from "uuid";

export default function YourModal(props: NodeViewProps) {
  const { node, updateAttributes, editor, getPos } = props;
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [value, setValue] = useState(node.attrs.value || '');

  useEffect(() => {
    setIsEditing(!!props.selected);
    if (props.selected) setValue(node.attrs.value || '');
  }, [props.selected]);

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
            classes.yourBlock,
            props.selected ? classes.selected : '',
            !node.attrs.value ? classes.empty : '',
          ].join(' ')}
          onClick={() => {
            if (!isEditing) {
              setIsEditing(true);
              editor.commands.focus(getPos());
            }
          }}
        >
          {/* Contenu du bloc */}
        </NodeViewWrapper>
      </Popover.Target>

      <Popover.Dropdown>
        {/* Interface utilisateur du Popover */}
      </Popover.Dropdown>
    </Popover>
  );
}
```

### 3. Ajouter les styles

```css
/* your-feature.module.css */
.yourBlock {
  position: relative;
  padding: 0.5rem;
  margin: 0.5rem 0;
  border-radius: 0.375rem;
  background-color: #f9fafb;
  border: 1px solid #e5e7eb;
}

.yourBlock.selected {
  outline: 2px solid #60a5fa;
  outline-offset: 2px;
}

.yourBlock.empty {
  min-height: 3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
```

### 4. Ajouter au menu slash

```typescript
// menu-items.ts
{
  title: "Your Feature",
  description: "Description of your feature",
  searchTerms: ["feature", "keyword1", "keyword2"],
  icon: YourIcon,
  command: ({ editor, range }: CommandProps) => {
    editor
      .chain()
      .focus()
      .deleteRange(range)
      .setYourFeature()
      .run();
  },
}
```

### 5. Enregistrer l'extension

```typescript
// extensions.ts
import { YourFeatureBlock } from './your-feature-extension';

export const mainExtensions = [
  // ...autres extensions
  YourFeatureBlock,
];
```

## Bonnes pratiques

1. **Gestion de l'état**
   - Utilisez les attributs du nœud pour stocker les données persistantes
   - Gérez l'état local avec `useState` pour l'UI temporaire
   - Évitez les effets de bord non nécessaires

2. **Performance**
   - Évitez les mises à jour inutiles des attributs
   - Utilisez `useMemo` et `useCallback` pour les fonctions coûteuses
   - Optimisez les rendus avec une granularité appropriée des composants

3. **UX**
   - Suivez les patterns existants (comme Math Block)
   - Gérez correctement le focus et la navigation au clavier
   - Fournissez des retours visuels clairs

4. **Styles**
   - Utilisez les modules CSS pour éviter les conflits
   - Suivez les conventions de nommage existantes
   - Réutilisez les variables CSS globales

## Dépannage

### Problèmes courants

1. **Le bloc disparaît après création**
   - Vérifiez que `addAttributes` est correctement défini
   - Assurez-vous que les attributs par défaut sont initialisés

2. **Le Popover ne s'ouvre pas**
   - Vérifiez la condition `opened` du Popover
   - Assurez-vous que `isEditing` est correctement géré

3. **Les mises à jour ne sont pas persistantes**
   - Utilisez `updateAttributes` pour mettre à jour les attributs du nœud
   - Vérifiez que les attributs sont correctement définis dans l'extension

4. **Problèmes de focus**
   - Utilisez `editor.commands.focus()` avec la position correcte
   - Gérez correctement les événements de clavier

### Débogage

1. Utilisez les outils de développement React
2. Vérifiez les attributs du nœud dans la console
3. Testez la navigation au clavier
4. Vérifiez les styles avec l'inspecteur

## Conclusion

L'ajout d'une nouvelle fonctionnalité nécessite une compréhension approfondie de TipTap et de React. Suivez ce guide étape par étape et référez-vous aux implémentations existantes comme Math Block ou Mistral AI pour des exemples concrets.

N'oubliez pas de :
- Tester exhaustivement votre fonctionnalité
- Documenter votre code
- Suivre les conventions du projet
- Gérer correctement les cas d'erreur
