"""Builds preview/index.html: the web app with google.script.run mocked by sample data.
Run: python3 preview/build.py  then open preview/index.html (add #new, #mine, #all, #admin; ?role=viewer)."""
import pathlib, re
root = pathlib.Path(__file__).resolve().parent.parent / 'apps-script'
html = (root / 'Index.html').read_text()
html = html.replace("<?!= include('Styles') ?>", (root / 'Styles.html').read_text())
html = html.replace("<?!= include('App') ?>", (pathlib.Path(__file__).parent / 'mock.html').read_text() + (root / 'App.html').read_text())
html = html.replace("<?= initialView ?>", "")
(pathlib.Path(__file__).parent / 'index.html').write_text(html)
print('wrote preview/index.html')
