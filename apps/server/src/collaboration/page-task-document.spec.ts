import * as Y from 'yjs';
import { yXmlFragmentToProsemirrorJSON } from '@tiptap/y-tiptap';
import { findTaskItem, PageTaskDocument } from './page-task-document';
import { extractPageTasks } from '../core/task/task-content';

const userA = '01972111-8b87-7491-9f76-3cd70d34df01';
const userB = '01972111-8b87-7491-9f76-3cd70d34df02';
const origin = (id: string) => ({
  source: 'connection',
  connection: { context: { user: { id } } },
});

function item(id?: string) {
  const element = new Y.XmlElement('taskItem');
  if (id) element.setAttribute('id', id);
  const paragraph = new Y.XmlElement('paragraph');
  paragraph.insert(0, [new Y.XmlText('Review')]);
  element.insert(0, [paragraph]);
  return element;
}

describe('page task identities', () => {
  it('matches historical index keys before edits and keeps them through a prepend', () => {
    const doc = new Y.Doc();
    const list = new Y.XmlElement('taskList');
    doc.getXmlFragment('default').push([list]);
    const original = item();
    list.push([original]);
    const [legacy] = extractPageTasks(
      yXmlFragmentToProsemirrorJSON(doc.getXmlFragment('default')),
    );
    const tracker = new PageTaskDocument(doc);
    expect(findTaskItem(doc, legacy.blockId)).toBe(original);
    const copy = item(legacy.blockId);
    const raw = item();
    doc.transact(() => list.insert(0, [raw, copy]), origin(userA));
    const creators = tracker.prepareItems();
    expect(findTaskItem(doc, legacy.blockId)).toBe(original);
    expect(
      new Set([raw, copy, original].map((node) => node.getAttribute('id')))
        .size,
    ).toBe(3);
    expect(creators.has(legacy.blockId)).toBe(false);
    expect(creators.get(copy.getAttribute('id'))).toBe(userA);
    expect(creators.get(raw.getAttribute('id'))).toBe(userA);
  });

  it('remembers the authenticated checkbox editor for each line when several people edit between saves', () => {
    const doc = new Y.Doc();
    const list = new Y.XmlElement('taskList');
    const first = item('first'),
      second = item('second');
    list.push([first, second]);
    doc.getXmlFragment('default').push([list]);
    const tracker = new PageTaskDocument(doc);
    doc.transact(() => first.setAttribute('checked', 'true'), origin(userA));
    doc.transact(() => second.setAttribute('checked', 'true'), origin(userB));
    doc.transact(() => first.setAttribute('other', 'edit'), origin(userB));
    expect(tracker.checkActors()).toEqual(
      new Map([
        ['first', userA],
        ['second', userB],
      ]),
    );
    doc.transact(() => first.setAttribute('checked', 'false'), origin(userB));
    expect(tracker.checkActors().get('first')).toBe(userB);
  });

  it('credits each authenticated insertion within the same debounced save, including nested and moved tasks', () => {
    const doc = new Y.Doc();
    const tracker = new PageTaskDocument(doc);
    const list = new Y.XmlElement('taskList');
    const parent = item('a');
    const nested = new Y.XmlElement('taskList');
    parent.push([nested]);
    list.push([parent]);
    doc.transact(
      () => doc.getXmlFragment('default').push([list]),
      origin(userA),
    );
    const child = item('b');
    doc.transact(() => nested.push([child]), origin(userB));
    expect(tracker.prepareItems()).toEqual(
      new Map([
        ['a', userA],
        ['b', userB],
      ]),
    );
    doc.transact(() => {
      nested.delete(0, 1);
      list.push([item('b')]);
    }, origin(userA));
    expect(tracker.prepareItems().get('b')).toBe(userB);
  });
});
