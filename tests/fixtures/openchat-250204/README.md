# 250204 open-chat compatibility reference

Extracted from the user-provided official sample archives dated 2025-02-04
(archive filenames contain `250204`; enclosed samples/guides are labeled 11.4.0).
These fixtures preserve the reference names independently of our export mappings.

- Android source: `theme_tab_open_chat_icon.xml` and `theme_tab_view_icon.xml`
  both reference `theme_maintab_ico_openchat[_focused]_image`.
- Android guide PDF pages 9–10: Open Chat and Piccoma are separate tabs.
- iOS sample: `TabBarStyle-Main.css` uses `-ios-view-*` and `maintabIcoView*`.
- iOS guide PDF pages 5–6: `-ios-openchats-*` uses those same View images;
  Piccoma is the Japanese tab, not an Open Chat alias.

`npm run verify:openchat` checks final exports against these names, both selected
and normal states, both image densities, and distinct Piccoma pixels. It also
checks the compiled Android selector references using the bundled AAPT2.
