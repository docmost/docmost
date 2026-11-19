import { Connection, Document, type WebSocketLike } from '@hocuspocus/server';
import * as Y from 'yjs';
import { EditorSchemaExtension } from './editor-schema.extension';

describe('collaboration editor schema', () => {
  let doc: Document;
  let extension: EditorSchemaExtension;

  beforeEach(() => {
    doc = new Document('page.test', {}, { flushDelay: false });
    extension = new EditorSchemaExtension();
  });
  afterEach(() => doc.destroy());

  async function connect(schema = '') {
    const request = new Request('https://example.test/collab' + schema);
    const context = await extension.onConnect({
      requestParameters: new URL(request.url).searchParams,
    } as any);
    const socket = {
      readyState: 1,
      send: jest.fn(),
    } as unknown as WebSocketLike;
    const peer = new Connection(socket, request, doc, '', context);
    await extension.connected({ connection: peer } as any);
    return peer;
  }

  it('refuses initial sync and queued offline deletions from older peers on a stored page with hints', async () => {
    const root = doc.getXmlFragment('default');
    const p = new Y.XmlElement('paragraph');
    root.push([p]);
    p.push([new Y.XmlText('Owner: '), new Y.XmlElement('templatePlaceholder')]);
    await extension.afterLoadDocument({ document: doc } as any);
    const legacy = await connect();
    const current = await connect('?editorSchema=1');
    expect(doc.getConnections()).toEqual([current]);
    const cached = new Y.Doc();
    Y.applyUpdate(cached, Y.encodeStateAsUpdate(doc));
    (cached.getXmlFragment('default').get(0) as Y.XmlElement).delete(1, 1);
    const deletion = Y.encodeStateAsUpdate(cached, Y.encodeStateVector(doc));
    const sync = async (connection: Connection, type: number) => {
      await extension.beforeSync({
        connection,
        type,
        payload: deletion,
      } as any);
      if (type === 2) Y.applyUpdate(doc, deletion);
    };
    await expect(sync(legacy, 0)).rejects.toMatchObject({
      reason: expect.stringMatching(/reload/i),
    });
    await expect(sync(legacy, 2)).rejects.toBeDefined();
    expect(p.length).toBe(2);
    await sync(current, 2);
    expect(p.toString()).toBe('<paragraph>Owner: </paragraph>');
    cached.destroy();
  });

  it('disconnects an already joined older peer before broadcasting the first nested placeholder', async () => {
    const root = doc.getXmlFragment('default');
    await extension.afterLoadDocument({ document: doc } as any);
    const legacy = await connect();
    const current = await connect('?editorSchema=1');
    const p = new Y.XmlElement('paragraph');
    root.push([p]);
    p.push([new Y.XmlText('Original')]);
    await expect(
      extension.beforeSync({ connection: legacy } as any),
    ).resolves.toBeUndefined();
    const peersAtBroadcast: Connection[][] = [];
    doc.on('update', () => peersAtBroadcast.push(doc.getConnections()));
    const list = new Y.XmlElement('listItem');
    const nested = new Y.XmlElement('paragraph');
    nested.insert(0, [new Y.XmlElement('templatePlaceholder')]);
    list.insert(0, [nested]);
    root.push([list]);
    expect(peersAtBroadcast).toEqual([[current]]);
    expect(legacy.readOnly).toBe(true);
    expect((nested.get(0) as Y.XmlElement).nodeName).toBe(
      'templatePlaceholder',
    );
  });
});
