import { SaxesParser } from 'saxes';

async function test() {
  console.log('Downloading XML...');
  const res = await fetch('https://lozko1991-blip.github.io/xmlprice/Masterevanew.xml');
  const xml = await res.text();
  console.log('Parsing categories...');

  const parser = new SaxesParser();
  const categories = [];
  let curCat = null;

  parser.on('opentag', (node) => {
    if (node.name === 'category') {
      curCat = {
        id: node.attributes.id,
        parentId: node.attributes.parentId || node.attributes.parentID || null,
        name: ''
      };
    }
  });

  parser.on('text', (t) => {
    if (curCat) curCat.name += t;
  });

  parser.on('closetag', (node) => {
    if (node.name === 'category' && curCat) {
      curCat.name = curCat.name.trim();
      categories.push(curCat);
      curCat = null;
    }
  });

  parser.write(xml).close();

  console.log(`Total categories parsed: ${categories.length}`);
  
  const catById = new Map(categories.map(c => [c.id, c]));
  let missingParentCount = 0;
  const missingParents = new Set();

  categories.forEach(c => {
    if (c.parentId) {
      if (!catById.has(c.parentId)) {
        missingParentCount++;
        missingParents.add(c.parentId);
      }
    }
  });

  console.log(`Categories with parentId: ${categories.filter(c => c.parentId).length}`);
  console.log(`Categories whose parent category is MISSING in XML: ${missingParentCount}`);
  console.log(`Sample missing parent IDs:`, Array.from(missingParents).slice(0, 10));

  // Let's check some category prefix statistics
  const prefixes = ['1000', '1100', '1111', '2222', '3333', '4444', '5555', '7777', '8888', '9999'];
  prefixes.forEach(pfx => {
    const pfxCats = categories.filter(c => c.id.startsWith(pfx));
    const pfxCatsWithParent = pfxCats.filter(c => c.parentId);
    const pfxCatsWithMissingParent = pfxCatsWithParent.filter(c => !catById.has(c.parentId));
    console.log(`Supplier ${pfx}: total cats=${pfxCats.length}, with parent=${pfxCatsWithParent.length}, missing parent=${pfxCatsWithMissingParent.length}`);
  });
}

test().catch(console.error);
