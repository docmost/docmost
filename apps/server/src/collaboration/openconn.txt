import { TiptapTransformer } from "@hocuspocus/transformer";
import test from "ava";
import * as Y from "yjs";
import { newHocuspocus, newHocuspocusProvider, sleep } from "../utils/index.ts";

test("direct connection prevents document from being removed from memory", async (t) => {
	await new Promise(async (resolve) => {
		const server = await newHocuspocus();

		await server.openDirectConnection("hocuspocus-test");

		const provider = newHocuspocusProvider(server, {
			onSynced() {
				provider.configuration.websocketProvider.destroy();
				provider.destroy();

				sleep(server.configuration.debounce + 50).then(() => {
					t.is(server.getDocumentsCount(), 1);
					resolve("done");
				});
			},
		});
	});
});
test("direct connection works even if provider is connected", async (t) => {
	await new Promise(async (resolve) => {
		const server = await newHocuspocus();

		const provider = newHocuspocusProvider(server, {
			onSynced() {
				provider.document.getMap("config").set("a", "valueFromProvider");
			},
		});

		await sleep(150);

		const directConnection =
			await server.openDirectConnection("hocuspocus-test");
		await directConnection.transact((doc) => {
			t.is("valueFromProvider", String(doc.getMap("config").get("a")));
			doc.getMap("config").set("b", "valueFromServerDirectConnection");
		});

		await sleep(100);
		t.is(
			"valueFromServerDirectConnection",
			String(provider.document.getMap("config").get("b")),
		);

		resolve(1);
		t.pass();
	});
});

test("direct connection can apply yjsUpdate", async (t) => {
	await new Promise(async (resolve) => {
		const server = await newHocuspocus();

		const provider = newHocuspocusProvider(server);

		t.is("", provider.document.getXmlFragment("default").toJSON());

		const directConnection =
			await server.openDirectConnection("hocuspocus-test");
		await directConnection.transact((doc) => {
			Y.applyUpdate(
				doc,
				Y.encodeStateAsUpdate(
					TiptapTransformer.toYdoc({
						type: "doc",
						content: [
							{
								type: "paragraph",
								content: [
									{
										type: "text",
										text: "Example Paragraph",
									},
								],
							},
						],
					}),
				),
			);
		});

		await sleep(100);

		t.is(
			"<paragraph>Example Paragraph</paragraph>",
			provider.document.getXmlFragment("default").toJSON(),
		);

		resolve(1);
		t.pass();
	});
});

test("direct connection can transact", async (t) => {
	const server = await newHocuspocus();

	const direct = await server.openDirectConnection("hocuspocus-test");

	await direct.transact((document) => {
		document.getArray("test").insert(0, ["value"]);
	});

	t.is(direct.document?.getArray("test").toJSON()[0], "value");
});

test("direct connection cannot transact once closed", async (t) => {
	const server = await newHocuspocus();

	const direct = await server.openDirectConnection("hocuspocus-test");
	await direct.disconnect();

	try {
		await direct.transact((document) => {
			document.getArray("test").insert(0, ["value"]);
		});
		t.fail(
			"DirectConnection should throw an error when transacting on closed connection",
		);
	} catch (err) {
		if (err instanceof Error && err.message === "direct connection closed") {
			t.pass();
		} else {
			t.fail("unknown error");
		}
	}
});

test("if a direct connection closes, the document should be unloaded if there is no other connection left", async (t) => {
	await new Promise(async (resolve) => {
		const server = await newHocuspocus();

		const direct = await server.openDirectConnection("hocuspocus-test1");
		t.is(server.getDocumentsCount(), 1);
		t.is(server.getConnectionsCount(), 1);

		await direct.transact((document) => {
			document.getArray("test").insert(0, ["value"]);
		});

		await direct.disconnect();

		t.is(server.getConnectionsCount(), 0);
		t.is(server.getDocumentsCount(), 0);
		resolve("done");
	});
});

test("direct connection transact awaits until onStoreDocument has finished", async (t) => {
	let onStoreDocumentFinished = false;

	await new Promise(async (resolve) => {
		const server = await newHocuspocus({
			onStoreDocument: async () => {
				onStoreDocumentFinished = false;
				await sleep(200);
				onStoreDocumentFinished = true;
			},
		});

		const direct = await server.openDirectConnection("hocuspocus-test2");
		t.is(server.getDocumentsCount(), 1);
		t.is(server.getConnectionsCount(), 1);

		t.is(onStoreDocumentFinished, false);
		await direct.transact((document) => {
			document.getArray("test").insert(0, ["value"]);
		});

		await direct.disconnect();
		t.is(onStoreDocumentFinished, true);

		t.is(server.getConnectionsCount(), 0);
		t.is(server.getDocumentsCount(), 0);
		t.is(onStoreDocumentFinished, true);
		resolve("done");
	});
});

test("direct connection transact awaits until onStoreDocument has finished, even if unloadImmediately=false", async (t) => {
	let onStoreDocumentFinished = false;
	let directConnDisconnecting = false;
	let storedAfterDisconnect = false;

	await new Promise(async (resolve) => {
		const server = await newHocuspocus({
			unloadImmediately: false,
			onStoreDocument: async () => {
				onStoreDocumentFinished = false;
				await sleep(200);
				onStoreDocumentFinished = true;

				if (directConnDisconnecting) {
					storedAfterDisconnect = true;
				}
			},
			afterUnloadDocument: async (data) => {
				if (!storedAfterDisconnect) {
					t.fail("this shouldnt be called");
				}
			},
		});

		const direct = await server.openDirectConnection("hocuspocus-test");
		t.is(server.getDocumentsCount(), 1);
		t.is(server.getConnectionsCount(), 1);

		t.is(onStoreDocumentFinished, false);
		await direct.transact((document) => {
			document.getArray("test").insert(0, ["value"]);
		});

		const provider = newHocuspocusProvider(server);
		provider.document.getMap("aaa").set("bb", "b");
		provider.disconnect();
		provider.configuration.websocketProvider.disconnect();

		await sleep(100);

		directConnDisconnecting = true;
		await direct.disconnect();
		t.is(onStoreDocumentFinished, true);

		t.is(server.getConnectionsCount(), 0);

		t.is(storedAfterDisconnect, true);

		resolve("done");
	});
});

test("does not unload document if an earlierly started onStoreDocument is still running", async (t) => {
	let onStoreDocumentStarted = 0;
	let onStoreDocumentFinished = 0;

	const server = await newHocuspocus({
		unloadImmediately: false,
		debounce: 100,
		onStoreDocument: async () => {
			onStoreDocumentStarted++;
			if (onStoreDocumentStarted === 1) {
				// Simulate a long running onStoreDocument for the first debounced save
				await sleep(500);
			}
			onStoreDocumentFinished++;
		},
		afterUnloadDocument: async (data) => {},
	});

	// Trigger a change, which will start a debounced onStoreDocument after 100ms
	const provider = newHocuspocusProvider(server);
	provider.document.getMap("aaa").set("bb", "b");

	await new Promise(async (resolve) => {
		provider.on("synced", resolve);

		if (!provider.unsyncedChanges) resolve("");
	});

	t.is(server.getDocumentsCount(), 1);
	t.is(server.getConnectionsCount(), 1);

	// Wait for the debounced onStoreDocument to start
	await sleep(110);
	t.is(onStoreDocumentStarted, 1);
	t.is(onStoreDocumentFinished, 0);

	// Open direct connection to prevent document from being unloaded
	const direct = await server.openDirectConnection("hocuspocus-test");
	t.is(server.getDocumentsCount(), 1);
	t.is(server.getConnectionsCount(), 2);

	// Close the websocket client
	provider.disconnect();
	provider.configuration.websocketProvider.disconnect();
	await sleep(50);
	t.is(server.getDocumentsCount(), 1);
	t.is(server.getConnectionsCount(), 1);
	t.is(onStoreDocumentStarted, 1);
	t.is(onStoreDocumentFinished, 0);

	direct.disconnect();
	await sleep(50);
	// Another save must not start before the first one has finished
	t.is(onStoreDocumentStarted, 1);
	t.is(onStoreDocumentFinished, 0);
	// Document must not be unloaded yet, because the first onStoreDocument is still running
	t.is(server.getDocumentsCount(), 1);
	t.is(server.getConnectionsCount(), 0);

	// Wait enough time to be sure the onStoreDocument has finished and ensure that the document was eventually unloaded
	await sleep(500);

	// The second onStoreDocument triggered by direct.disconnect must have started and finished now
	t.is(onStoreDocumentStarted, 2);
	t.is(onStoreDocumentFinished, 2);
	// The document must have been unloaded now as well
	t.is(server.getDocumentsCount(), 0);
});

test("creating a websocket connection after transact but before debounce interval doesnt create different docs", async (t) => {
	let onStoreDocumentFinished = false;
	let disconnected = false;

	await new Promise(async (resolve) => {
		const server = await newHocuspocus({
			onStoreDocument: async () => {
				onStoreDocumentFinished = false;
				await sleep(200);
				onStoreDocumentFinished = true;
			},
			async afterUnloadDocument(data) {
				console.log("called");
				if (disconnected) {
					t.fail("must not be called");
				}
			},
		});

		const direct = await server.openDirectConnection("hocuspocus-test");
		t.is(server.getDocumentsCount(), 1);
		t.is(server.getConnectionsCount(), 1);

		t.is(onStoreDocumentFinished, false);
		await direct.transact((document) => {
			document.transact(() => {
				document.getArray("test").insert(0, ["value"]);
			}, "testOrigin");
		});

		await direct.disconnect();
		t.is(onStoreDocumentFinished, true);
		disconnected = true;

		t.is(server.getConnectionsCount(), 0);
		t.is(server.getDocumentsCount(), 0);
		t.is(onStoreDocumentFinished, true);

		const provider = newHocuspocusProvider(server);

		await sleep(server.configuration.debounce * 2);

		resolve("done");
	});
});
