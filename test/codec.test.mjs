import test from "node:test";
import assert from "node:assert/strict";
import * as C from "../js/codec.js";

test("md5 matches RFC 1321 vectors", () => {
  assert.equal(C.md5(""), "d41d8cd98f00b204e9800998ecf8427e");
  assert.equal(C.md5("abc"), "900150983cd24fb0d6963f7d28e17f72");
  assert.equal(C.md5("message digest"), "f96b697d7cb7938d525a2f31aaf161d0");
  assert.equal(C.md5("12345678901234567890123456789012345678901234567890123456789012345678901234567890"), "57edf4a22be3c955ac49da2e2107b67a");
  // padding boundary cases (55, 56, 64 bytes)
  assert.equal(C.md5("a".repeat(55)), "ef1772b6dff9a122358552954ad0df65");
  assert.equal(C.md5("a".repeat(56)), "3b0c8ac703f828b04c6c197006d17218");
  assert.equal(C.md5("a".repeat(64)), "014842d480b571495a4a0363793f7367");
});

test("sha-256 via WebCrypto", async () => {
  assert.equal(await C.digest("SHA-256", "abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("base64 round trips, including unicode and url-safe input", () => {
  for (const s of ["", "a", "ab", "abc", "héllo wörld ✓", "🙂 emoji"]) assert.equal(C.b64decode(C.b64encode(s)), s);
  assert.equal(C.b64decode("aGk"), "hi"); // no padding
  assert.equal(C.b64decode("_-8"), C.b64decode("/+8=")); // url-safe alphabet equals the standard one
  assert.throws(() => C.b64decode("not base64!!"), /Base64/);
});

test("hex encode and decode", () => {
  assert.equal(C.hexEncode("hi"), "6869");
  assert.equal(C.hexDecode("68 69"), "hi");
  assert.equal(C.hexDecode("0x68,0x69"), "hi");
  assert.equal(C.hexDecode("\\x68\\x69"), "hi");
  assert.throws(() => C.hexDecode("abc"), /odd/);
  assert.throws(() => C.hexDecode("zz"), /hex/);
});

test("html entities", () => {
  assert.equal(C.htmlEncode(`<a href="x">&'</a>`), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;");
  assert.equal(C.htmlDecode("&lt;b&gt; &amp; &#65; &#x42; &unknown;"), "<b> & A B &unknown;");
  assert.equal(C.htmlDecode(C.htmlEncode(`<script>alert("x")</script>`)), `<script>alert("x")</script>`);
});

test("url encode and decode", () => {
  assert.equal(C.urlEncode("a b&c=d/é"), "a%20b%26c%3Dd%2F%C3%A9");
  assert.equal(C.urlDecode("a%20b+c"), "a b c");
  assert.throws(() => C.urlDecode("%E0%A4%A"));
});

test("jwt decode (jwt.io sample)", () => {
  const t = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
  const j = C.jwtDecode(t);
  assert.deepEqual(j.header, { alg: "HS256", typ: "JWT" });
  assert.equal(j.payload.name, "John Doe");
  assert.equal(j.payload.iat, 1516239022);
  assert.throws(() => C.jwtDecode("onlyonepart"), /parts/);
  assert.throws(() => C.jwtDecode("a.b.c"), /JSON/);
});

test("timestamps", () => {
  assert.equal(C.describeTime("1700000000").iso, "2023-11-14T22:13:20.000Z");
  assert.equal(C.describeTime("1700000000000").iso, "2023-11-14T22:13:20.000Z"); // ms detected
  assert.equal(C.describeTime("2023-11-14T22:13:20Z").unix, 1700000000);
  assert.throws(() => C.describeTime("not a date"));
  assert.equal(C.fmtMs(25 * 60000), "25:00");
  assert.equal(C.fmtMs(-5), "00:00");
  assert.equal(C.fmtMs(61000), "01:01");
});

test("json helpers", () => {
  assert.equal(C.formatJson('{"a":[1,2]}', 2), '{\n  "a": [\n    1,\n    2\n  ]\n}');
  assert.equal(C.minifyJson('{ "a": [1, 2] }'), '{"a":[1,2]}');
  assert.throws(() => C.formatJson("{nope}"));
});

test("regex runner", () => {
  const r = C.runRegex("(\\d+)-(\\w+)", "", "10-ab and 22-cd");
  assert.equal(r.matches.length, 2);
  assert.deepEqual(r.matches[1].groups, ["22", "cd"]);
  assert.equal(r.matches[1].index, 10);
  assert.ok(C.runRegex("(", "g", "x").error);
  assert.deepEqual(C.runRegex("", "g", "x").matches, []);
  assert.equal(C.runRegex("a*", "g", "aaa", 2).matches.length, 2); // cap respected, no infinite loop on empty matches
});

test("random strings", () => {
  const s = C.randomString(64, "ab");
  assert.equal(s.length, 64);
  assert.match(s, /^[ab]+$/);
  assert.throws(() => C.randomString(8, ""));
});

test("fuzzy scoring", () => {
  assert.ok(C.fuzzyScore("gh", "GitHub") > 0);
  assert.ok(C.fuzzyScore("git", "GitHub") > C.fuzzyScore("gb", "GitHub")); // substring beats scattered letters
  assert.equal(C.fuzzyScore("zzz", "GitHub"), -1);
  assert.ok(C.fuzzyScore("hack", "Hack The Box") > C.fuzzyScore("hack", "The Hacker News")); // earlier match wins
});

test("normalizeUrl only lets http(s) through", () => {
  assert.equal(C.normalizeUrl("example.com"), "https://example.com/");
  assert.equal(C.normalizeUrl("  http://example.com/a?b=1 "), "http://example.com/a?b=1");
  assert.equal(C.normalizeUrl("localhost:3000"), "http://localhost:3000/");
  assert.equal(C.normalizeUrl("127.0.0.1:8080/x"), "http://127.0.0.1:8080/x");
  assert.equal(C.normalizeUrl("example.com:8443"), "https://example.com:8443/");
  for (const bad of ["javascript:alert(1)", "data:text/html,hi", "file:///etc/passwd", "ftp://example.com", "", "http://"]) {
    assert.throws(() => C.normalizeUrl(bad), undefined, bad);
  }
});

test("hostOf", () => {
  assert.equal(C.hostOf("https://www.example.com/a"), "example.com");
  assert.equal(C.hostOf("http://localhost:3000/x"), "localhost:3000");
  assert.equal(C.hostOf("nope"), "");
});
