import { test } from "node:test";
import assert from "node:assert/strict";
import { clearImageCache, dropBrokenImages, imageUrls } from "../src/lib/email/images";

const fake = (map: Record<string, [number, string]>) => async (url: string) => {
  const [status, type] = map[url] ?? [404, "text/html"];
  return new Response(status === 200 ? "x" : "no", { status, headers: { "content-type": type } });
};

test("finds image urls", () => {
  assert.deepEqual(imageUrls('<img src="https://a/x.jpg" width="1"><img alt="" src="https://a/y.jpg">'), ["https://a/x.jpg", "https://a/y.jpg"]);
});

test("removes broken images and their links, keeps good ones", async () => {
  clearImageCache();
  const html =
    '<a href="https://s/p"><img src="https://s/bad.jpg" width="180"></a><p>t</p><a href="https://s/q"><img src="https://s/good.jpg"></a><img src="https://s/html.jpg">';
  const r = await dropBrokenImages(
    html,
    fake({ "https://s/good.jpg": [200, "image/jpeg"], "https://s/bad.jpg": [500, "text/html"], "https://s/html.jpg": [200, "text/html"] }),
  );
  assert.deepEqual(r.broken.sort(), ["https://s/bad.jpg", "https://s/html.jpg"]);
  assert.equal(r.html, '<p>t</p><a href="https://s/q"><img src="https://s/good.jpg"></a>');
});

test("no images: untouched", async () => {
  const r = await dropBrokenImages("<p>hi</p>", async () => {
    throw new Error("should not fetch");
  });
  assert.equal(r.html, "<p>hi</p>");
});
