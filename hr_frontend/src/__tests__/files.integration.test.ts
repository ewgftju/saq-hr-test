// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("Файлы учебных материалов", () => {
  it("сохраняет файл, читает его после повторного открытия хранилища и удаляет по запросу", async () => {
    vi.stubGlobal("indexedDB", new IDBFactory());
    const firstSession = await import("../api/storage");
    const contents = new Uint8Array([
      0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37,
    ]);
    // Native Node Blob implements structured clone as IndexedDB does in a browser.
    const { Blob } = await import("node:buffer");
    const original = new Blob([contents], { type: "application/pdf" });
    const fileId = await firstSession.saveFile(
      original as unknown as globalThis.Blob,
      "Памятка.pdf",
    );
    vi.resetModules();
    const reopenedSession = await import("../api/storage");
    const stored = await reopenedSession.getFile(fileId);
    expect(stored?.type).toBe("application/pdf");
    expect(new Uint8Array(await stored!.arrayBuffer())).toEqual(contents);
    await reopenedSession.deleteFile(fileId);
    expect(await reopenedSession.getFile(fileId)).toBeUndefined();
  });

  it("не принимает слишком большой файл и объясняет недоступность локального хранилища", async () => {
    vi.stubGlobal("indexedDB", undefined);
    const storage = await import("../api/storage");
    const oversized = new Blob(["small"]);
    Object.defineProperty(oversized, "size", { value: 50 * 1024 * 1024 + 1 });
    await expect(
      storage.saveFile(oversized, "Слишком большой.pdf"),
    ).rejects.toThrow("50 МБ");
    await expect(
      storage.saveFile(new Blob(["document"]), "Материал.txt"),
    ).rejects.toThrow(/Хранилище файлов недоступно/);
  });
});
